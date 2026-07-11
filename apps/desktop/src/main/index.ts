import { app, BrowserWindow, dialog, ipcMain, shell } from "electron";
import { mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

import {
  migrateDatabase,
  openDatabase,
  type SqliteDatabase,
} from "@lifeafter-assistant/database";
import { marketCatalogSchema, nanoCatalogSchema } from "@lifeafter-assistant/data-schema";

const APP_ID = "io.github.chincika.lifeafter-growth-assistant";
const portableDirectory = process.env.PORTABLE_EXECUTABLE_DIR;
const testDataDirectory = process.env.LIFEAFTER_ASSISTANT_USER_DATA_DIR;
const dataRoot = portableDirectory
  ? join(portableDirectory, "Data")
  : (testDataDirectory ?? app.getPath("userData"));

if (portableDirectory || testDataDirectory) app.setPath("userData", dataRoot);
app.setAppUserModelId(APP_ID);
let database: SqliteDatabase | undefined;

function bundledContentDirectory(): string {
  return app.isPackaged
    ? join(process.resourcesPath, "content", "base")
    : join(app.getAppPath(), "..", "..", "content", "base");
}

function installBundledContent(target: SqliteDatabase): void {
  const directory = bundledContentDirectory();
  const market = marketCatalogSchema.parse(
    JSON.parse(readFileSync(join(directory, "market-items.json"), "utf8")),
  );
  const nano = nanoCatalogSchema.parse(
    JSON.parse(readFileSync(join(directory, "nano-items.json"), "utf8")),
  );
  const installed = target
    .prepare("SELECT 1 FROM content_releases WHERE version = ?")
    .get(market.contentVersion);
  if (installed) return;

  const insert = target.prepare(`
    INSERT INTO public_entities(id, entity_type, name, payload_json, content_version, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      entity_type = excluded.entity_type,
      name = excluded.name,
      payload_json = excluded.payload_json,
      content_version = excluded.content_version,
      updated_at = excluded.updated_at
  `);
  const now = new Date().toISOString();
  const nanoById = new Map(nano.items.map((item) => [item.itemId, item]));
  target.exec("BEGIN IMMEDIATE");
  try {
    for (const item of market.items) {
      insert.run(
        item.id,
        "market-item",
        item.name,
        JSON.stringify({ ...item, nano: nanoById.get(item.id) ?? null }),
        market.contentVersion,
        now,
      );
    }
    target
      .prepare(
        "INSERT INTO content_releases(version, applied_at, manifest_sha256) VALUES (?, ?, ?)",
      )
      .run(market.contentVersion, now, "0".repeat(64));
    target.exec("COMMIT");
  } catch (error) {
    target.exec("ROLLBACK");
    throw error;
  }
}

function listMarketItems(target: SqliteDatabase) {
  const recipeChoices = new Map(
    target.prepare("SELECT product_entity_id, ingredient_entity_id, acquisition_mode FROM user_recipe_choices").all().map((row) => {
      const value = row as Record<string, unknown>;
      return [`${value.product_entity_id}:${value.ingredient_entity_id}`, String(value.acquisition_mode)] as const;
    }),
  );
  return target
    .prepare(`
      WITH all_market_entities AS (
        SELECT id, entity_type, name, payload_json FROM public_entities
        UNION ALL
        SELECT id, entity_type, name, payload_json FROM user_entities
      )
      SELECT p.id, p.name, p.payload_json AS payloadJson,
             u.market_price AS marketPrice, COALESCE(u.focused, 0) AS focused
      FROM all_market_entities p
      LEFT JOIN user_item_state u ON u.entity_id = p.id
      WHERE p.entity_type = 'market-item'
      ORDER BY
        COALESCE(u.focused, 0) DESC,
        CAST(json_extract(p.payload_json, '$.legacyType') AS INTEGER),
        CAST(json_extract(p.payload_json, '$.level') AS INTEGER),
        CAST(json_extract(p.payload_json, '$.sortOrder') AS INTEGER)
    `)
    .all()
    .map((row) => {
      const value = row as Record<string, unknown>;
      const payload = JSON.parse(String(value.payloadJson)) as Record<string, unknown>;
      return {
        id: String(value.id),
        name: String(value.name),
        category: String(payload.category),
        resourceType: Number(payload.legacyType),
        level: Number(payload.level),
        couponCost: Number(payload.couponCost),
        recipe: (Array.isArray(payload.recipe) ? payload.recipe : []).map((entry) => {
          const ingredient = entry as Record<string, unknown>;
          const ingredientId = String(ingredient.ingredientId);
          const defaultMode = String(ingredient.defaultAcquisitionMode);
          return {
            ingredientId,
            quantity: Number(ingredient.quantity),
            acquisitionMode: recipeChoices.get(`${value.id}:${ingredientId}`) ?? defaultMode,
          };
        }),
        marketPrice: value.marketPrice === null ? null : Number(value.marketPrice),
        focused: Boolean(value.focused),
        hasRecipe: Array.isArray(payload.recipe) && payload.recipe.length > 0,
        hasNano: payload.nano !== null,
      };
    });
}

function assertWritableDataRoot(): void {
  try {
    mkdirSync(dataRoot, { recursive: true });
    const probe = join(dataRoot, `.write-test-${randomUUID()}`);
    writeFileSync(probe, "ok", { encoding: "utf8", flag: "wx" });
    unlinkSync(probe);
  } catch (error) {
    dialog.showErrorBox(
      "数据目录不可写",
      `无法写入数据目录：\n${dataRoot}\n\n请将便携版移动到可写目录后重试。\n\n${String(error)}`,
    );
    app.exit(1);
  }
}

function isTrustedExternalUrl(rawUrl: string): boolean {
  try {
    const url = new URL(rawUrl);
    return (
      url.protocol === "https:" &&
      (url.hostname === "github.com" || url.hostname.endsWith(".github.com"))
    );
  } catch {
    return false;
  }
}

function isTrustedRendererUrl(rawUrl: string): boolean {
  try {
    const url = new URL(rawUrl);
    if (url.protocol === "file:") return true;
    return (
      process.env.ELECTRON_RENDERER_URL !== undefined &&
      url.origin === new URL(process.env.ELECTRON_RENDERER_URL).origin
    );
  } catch {
    return false;
  }
}

function registerIpcHandlers(databaseVersion: number): void {
  ipcMain.handle("runtime:get-info", (event) => {
    if (!isTrustedRendererUrl(event.senderFrame?.url ?? "")) {
      throw new Error("Rejected IPC request from an untrusted renderer");
    }
    return {
      platform: process.platform,
      portable: Boolean(portableDirectory),
      appVersion: app.getVersion(),
      databaseVersion,
    };
  });
  ipcMain.handle("market:list-items", (event) => {
    if (!isTrustedRendererUrl(event.senderFrame?.url ?? "") || !database) {
      throw new Error("Rejected market request");
    }
    return listMarketItems(database);
  });
  ipcMain.handle(
    "market:set-item-state",
    (event, input: { id: string; marketPrice: number | null; focused: boolean }) => {
      if (!isTrustedRendererUrl(event.senderFrame?.url ?? "") || !database) {
        throw new Error("Rejected market update");
      }
      if (!/^[a-z0-9][a-z0-9._-]{2,127}$/.test(input.id)) throw new Error("Invalid item ID");
      if (input.marketPrice !== null && (!Number.isInteger(input.marketPrice) || input.marketPrice < 0)) {
        throw new Error("Invalid market price");
      }
      database.prepare(`
        INSERT INTO user_item_state(entity_id, market_price, focused, updated_at)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(entity_id) DO UPDATE SET
          market_price = excluded.market_price,
          focused = excluded.focused,
          updated_at = excluded.updated_at
      `).run(input.id, input.marketPrice, input.focused ? 1 : 0, new Date().toISOString());
    },
  );
  ipcMain.handle("market:add-custom-item", (event, input: {
    name: string; resourceType: number; level: number; marketPrice: number | null; couponCost: number;
    ingredients: Array<{ ingredientId: string; quantity: number; acquisitionMode: "craft" | "purchase" }>;
  }) => {
    if (!isTrustedRendererUrl(event.senderFrame?.url ?? "") || !database) throw new Error("Rejected custom item");
    const name = input.name.trim();
    if (!name || name.length > 200) throw new Error("产品名称无效");
    if (!Number.isInteger(input.resourceType) || input.resourceType < 0 || input.resourceType > 21) throw new Error("产品分类无效");
    if (!Number.isInteger(input.level) || input.level < 0 || input.level > 1000) throw new Error("产品等级无效");
    if (!Number.isInteger(input.couponCost) || input.couponCost < 0) throw new Error("采集券成本无效");
    if (input.marketPrice !== null && (!Number.isInteger(input.marketPrice) || input.marketPrice < 0)) throw new Error("售价无效");
    if (!Array.isArray(input.ingredients) || input.ingredients.length > 100) throw new Error("材料数量无效");
    const duplicate = database.prepare(`
      SELECT 1 FROM public_entities WHERE entity_type='market-item' AND name=?
      UNION ALL SELECT 1 FROM user_entities WHERE entity_type='market-item' AND name=? LIMIT 1
    `).get(name, name);
    if (duplicate) throw new Error(`产品“${name}”已经存在`);
    const validId = /^[a-z0-9][a-z0-9._-]{2,127}$/;
    const seen = new Set<string>();
    const recipe = input.ingredients.map((ingredient) => {
      if (!validId.test(ingredient.ingredientId) || seen.has(ingredient.ingredientId)) throw new Error("材料重复或无效");
      seen.add(ingredient.ingredientId);
      if (!Number.isFinite(ingredient.quantity) || ingredient.quantity <= 0) throw new Error("材料数量必须大于零");
      if (ingredient.acquisitionMode !== "craft" && ingredient.acquisitionMode !== "purchase") throw new Error("材料获取方式无效");
      const exists = database!.prepare(`
        SELECT 1 FROM public_entities WHERE id=? AND entity_type='market-item'
        UNION ALL SELECT 1 FROM user_entities WHERE id=? AND entity_type='market-item' LIMIT 1
      `).get(ingredient.ingredientId, ingredient.ingredientId);
      if (!exists) throw new Error("材料不存在");
      return { ingredientId: ingredient.ingredientId, quantity: ingredient.quantity, acquisitionMode: ingredient.acquisitionMode };
    });
    const categories = ["wood","stone","hemp","animal","special","semi-finished","armor","shield","hat","blade","bow","shotgun","smg","assault-rifle","sniper-rifle","grenade-launcher","flamethrower","pistol","melee-shield","electromagnetic-gun","drone","consumable"];
    const id = `user.item.${randomUUID()}`;
    const now = new Date().toISOString();
    const payload = { id, name, category: categories[input.resourceType], legacyType: input.resourceType, sortOrder: 2_000_000_000, level: input.level, couponCost: input.couponCost, legacyAliases: [], recipe: recipe.map((entry) => ({ ingredientId: entry.ingredientId, quantity: entry.quantity, defaultAcquisitionMode: entry.acquisitionMode })), custom: true };
    database.exec("BEGIN IMMEDIATE");
    try {
      database.prepare("INSERT INTO user_entities(id,entity_type,name,payload_json,created_at,updated_at) VALUES (?, 'market-item', ?, ?, ?, ?)").run(id, name, JSON.stringify(payload), now, now);
      database.prepare("INSERT INTO user_item_state(entity_id,market_price,focused,updated_at) VALUES (?,?,0,?)").run(id, input.marketPrice, now);
      database.exec("COMMIT");
    } catch (error) { database.exec("ROLLBACK"); throw error; }
    return id;
  });
  ipcMain.handle(
    "market:set-recipe-choice",
    (event, input: { productId: string; ingredientId: string; acquisitionMode: string }) => {
      if (!isTrustedRendererUrl(event.senderFrame?.url ?? "") || !database) throw new Error("Rejected recipe update");
      const validId = /^[a-z0-9][a-z0-9._-]{2,127}$/;
      if (!validId.test(input.productId) || !validId.test(input.ingredientId)) throw new Error("Invalid recipe ID");
      if (input.acquisitionMode !== "craft" && input.acquisitionMode !== "purchase") throw new Error("Invalid acquisition mode");
      database.prepare(`
        INSERT INTO user_recipe_choices(product_entity_id, ingredient_entity_id, acquisition_mode, updated_at)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(product_entity_id, ingredient_entity_id) DO UPDATE SET
          acquisition_mode = excluded.acquisition_mode, updated_at = excluded.updated_at
      `).run(input.productId, input.ingredientId, input.acquisitionMode, new Date().toISOString());
    },
  );
}

function createWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1240,
    height: 820,
    minWidth: 960,
    minHeight: 640,
    show: false,
    title: "明日之后养成助手",
    backgroundColor: "#111827",
    webPreferences: {
      preload: join(import.meta.dirname, "../preload/index.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  window.once("ready-to-show", () => window.show());

  window.webContents.setWindowOpenHandler(({ url }) => {
    if (isTrustedExternalUrl(url)) void shell.openExternal(url);
    return { action: "deny" };
  });

  window.webContents.on("will-navigate", (event, url) => {
    const currentUrl = window.webContents.getURL();
    if (url !== currentUrl) event.preventDefault();
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    void window.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    void window.loadFile(join(import.meta.dirname, "../renderer/index.html"));
  }

  return window;
}

app.whenReady().then(() => {
  assertWritableDataRoot();
  database = openDatabase(join(dataRoot, "assistant.sqlite"));
  const databaseVersion = migrateDatabase(database);
  installBundledContent(database);
  registerIpcHandlers(databaseVersion);
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
}).catch((error) => {
  mkdirSync(dataRoot, { recursive: true });
  writeFileSync(join(dataRoot, "startup-error.log"), String(error), "utf8");
  dialog.showErrorBox("启动失败", `程序无法启动：\n${String(error)}`);
  app.exit(1);
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  database?.close();
  database = undefined;
});
