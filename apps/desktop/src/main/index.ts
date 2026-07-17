import { app, BrowserWindow, dialog, ipcMain, net, protocol, session, shell, type IpcMainInvokeEvent } from "electron";
import { existsSync, mkdirSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";

import {
  migrateDatabase,
  openDatabase,
  type SqliteDatabase,
} from "@lifeafter-assistant/database";
import { activityCatalogSchema, baseDataPackageSchema, cookbookCatalogSchema, marketCatalogSchema, nanoCatalogSchema, newsCatalogSchema, type ActivityCatalog, type BaseDataPackage, type NewsCatalog } from "@lifeafter-assistant/data-schema";
import {
  backupPath,
  createBackup,
  ensureAutomaticBackups,
  exportBackup,
  getSettings,
  importLegacyData,
  listBackups,
  restoreBackup,
  setSettings,
  type AppSettings,
} from "./user-data-service.js";
import { applyContentManifest, readCachedContent } from "./content-update-service.js";
import { fetchLatestContentManifest } from "./content-manifest-source.js";
import { refreshActivityCatalogOnLaunch } from "./activity-catalog-source.js";
import { planUpdateChecks } from "./update-check-policy.js";
import { cachedNewsImageMatches, detectNewsImageContentType, newsImageProtocolUrl, newsImageRemoteCandidates, remoteNewsImageFetchUrl, type NewsImageSource } from "./news-image-cache.js";
import { isClientVersionNewer } from "./client-version.js";

const APP_ID = "io.github.chincika.lifeafter-growth-assistant";
protocol.registerSchemesAsPrivileged([{ scheme: "lifeafter-news", privileges: { secure: true, standard: true, supportFetchAPI: true } }]);
const executableDirectory = dirname(app.getPath("exe"));
const directoryPortable = app.isPackaged && existsSync(join(executableDirectory, "portable-mode.json"));
const portableDirectory = process.env.PORTABLE_EXECUTABLE_DIR ?? (directoryPortable ? executableDirectory : undefined);
const testDataDirectory = process.env.LIFEAFTER_ASSISTANT_USER_DATA_DIR;
const dataRoot = portableDirectory
  ? join(portableDirectory, "Data")
  : (testDataDirectory ?? app.getPath("userData"));

if (portableDirectory || testDataDirectory) app.setPath("userData", dataRoot);
app.setAppUserModelId(APP_ID);
let database: SqliteDatabase | undefined;
const newsImageSessionNonce = randomUUID();
const freshNewsImageKeys = new Set<string>();

interface CookbookDocument { recipes: Array<{ id: string; position: number; name: string; method: string; effect: string; duration: string; defaultUnlocked: boolean }> }
function readBundledJson<T>(fileName: string): T {
  return JSON.parse(readFileSync(join(bundledContentDirectory(), fileName), "utf8")) as T;
}

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
    target.prepare("SELECT product_entity_id, ingredient_entity_id, acquisition_mode, quantity_override FROM user_recipe_choices").all().map((row) => {
      const value = row as Record<string, unknown>;
      return [`${value.product_entity_id}:${value.ingredient_entity_id}`, { mode: String(value.acquisition_mode), quantity: value.quantity_override === null ? null : Number(value.quantity_override) }] as const;
    }),
  );
  const legacyNanoRow = target.prepare("SELECT value_json AS valueJson FROM settings WHERE key='legacy-import-preserved'").get() as { valueJson: string } | undefined;
  const legacyNano = new Map<string, any>();
  if (legacyNanoRow) { try { for (const item of JSON.parse(legacyNanoRow.valueJson).nano ?? []) legacyNano.set(String(item.name), item); } catch { /* ignore invalid preserved legacy overrides */ } }
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
          const choice = recipeChoices.get(`${value.id}:${ingredientId}`);
          return {
            ingredientId,
            quantity: choice?.quantity ?? Number(ingredient.quantity),
            acquisitionMode: choice?.mode ?? defaultMode,
          };
        }),
        marketPrice: value.marketPrice === null ? null : Number(value.marketPrice),
        focused: Boolean(value.focused),
        hasRecipe: Array.isArray(payload.recipe) && payload.recipe.length > 0,
        hasNano: payload.nano !== null || legacyNano.has(String(value.name)),
        nano: legacyNano.has(String(value.name)) ? (() => { const item = legacyNano.get(String(value.name)); return { itemId: String(value.id), nano1: { min: Number(item.nami_1_min), max: Number(item.nami_1_max), average: Number(item.nami_1_avg) }, nano2: { min: Number(item.nami_2_min), max: Number(item.nami_2_max), average: Number(item.nami_2_avg) }, nano3: { min: Number(item.nami_3_min), max: Number(item.nami_3_max), average: Number(item.nami_3_avg) } }; })() : (payload.nano ?? null),
      };
    });
}

function referenceContent(target: SqliteDatabase) {
  let remoteBase: BaseDataPackage | undefined; let remoteActivities: ActivityCatalog | undefined; let remoteNews: NewsCatalog | undefined;
  try { const value = readCachedContent<unknown>(dataRoot, "base-data"); if (value) remoteBase = baseDataPackageSchema.parse(value); } catch { remoteBase = undefined; }
  try { const value = readCachedContent<unknown>(dataRoot, "activities"); if (value) remoteActivities = activityCatalogSchema.parse(value); } catch { remoteActivities = undefined; }
  try { const value = readCachedContent<unknown>(dataRoot, "news"); if (value) remoteNews = newsCatalogSchema.parse(value); } catch { remoteNews = undefined; }
  const cookbook = remoteBase?.cookbook ?? cookbookCatalogSchema.parse(readBundledJson<unknown>("cookbook.json"));
  const unlocks = new Map((target.prepare("SELECT recipe_id AS recipeId,unlocked FROM cookbook_unlocks").all() as Array<{ recipeId: string; unlocked: number }>).map((row) => [row.recipeId, Boolean(row.unlocked)]));
  const bundledActivities = readBundledJson<{ categories: Array<{ id: string; name: string; sortOrder: number }>; entries: unknown[] }>("activities.json");
  const categoryNames = new Map(bundledActivities.categories.map((category) => [category.id, category.name]));
  const activities = remoteActivities ? {
    categories: [...new Set(remoteActivities.entries.map((entry) => entry.category))].map((id, index) => ({ id, name: categoryNames.get(id) ?? id, sortOrder: index })),
    entries: remoteActivities.entries.map((entry) => ({ id: entry.id, category: entry.category, categoryName: categoryNames.get(entry.category) ?? entry.category, title: entry.title, version: "", condition: entry.description ?? "", floors: null, startDate: entry.startDate, endDate: entry.endDate, rawStart: entry.startDate, rawEnd: entry.endDate ?? "待定" })),
  } : bundledActivities;
  const bundledNews = readBundledJson<{ enabled: boolean; entries: Array<{ id: string; publishedDate?: string; title: string; imageUrl: string }> }>("survivor-news.json");
  const news = remoteNews ? { enabled: true, entries: remoteNews.entries.filter((entry) => !entry.withdrawn).map((entry) => ({ id: entry.id, publishedDate: entry.publishedAt.slice(0,10), title: entry.title, imageUrl: newsImageProtocolUrl(entry.id,entry.image.sha256,newsImageSessionNonce) })) } : { ...bundledNews, entries: bundledNews.entries.map((entry) => ({ ...entry, imageUrl: newsImageProtocolUrl(entry.id,undefined,newsImageSessionNonce) })) };
  return {
    cookbook: cookbook.recipes.map(({ defaultUnlocked, ...recipe }) => ({ ...recipe, unlocked: unlocks.get(recipe.id) ?? defaultUnlocked })),
    activities,
    news,
  };
}

function assertTrusted(event: IpcMainInvokeEvent, label: string) {
  if (!isTrustedRendererUrl(event.senderFrame?.url ?? "") || !database) throw new Error(`Rejected ${label} request`);
  return database;
}

function newsImageSource(id: string): NewsImageSource | undefined {
  try {
    const remote = readCachedContent<unknown>(dataRoot, "news");
    if (remote) { const entry=newsCatalogSchema.parse(remote).entries.find((item) => item.id===id); if(entry)return{url:entry.image.url,sha256:entry.image.sha256}; }
  } catch { /* use bundled history */ }
  const entry=readBundledJson<{ entries: Array<{ id: string; imageUrl: string }> }>("survivor-news.json").entries.find((item) => item.id===id);
  return entry?{url:entry.imageUrl}:undefined;
}

async function downloadFreshNewsImage(source: NewsImageSource): Promise<{buffer:Buffer;type:string}> {
  const candidates=newsImageRemoteCandidates(source.url);
  for (let candidateIndex=0;candidateIndex<candidates.length;candidateIndex+=1) {
    for (let attempt=0;attempt<2;attempt+=1) {
      try {
        const nonce=`${newsImageSessionNonce}-${candidateIndex}-${attempt}`;
        const response=await net.fetch(remoteNewsImageFetchUrl(candidates[candidateIndex]!,source.sha256,nonce),{cache:"no-store",signal:AbortSignal.timeout(60_000)});
        if (!response.ok) continue;
        const buffer=Buffer.from(await response.arrayBuffer());
        if (buffer.length>64*1024*1024||!cachedNewsImageMatches(buffer,source.sha256)) continue;
        const type=detectNewsImageContentType(buffer);
        if (type) return {buffer,type};
      } catch { /* retry the primary source, then use the trusted GitHub Raw fallback */ }
    }
  }
  throw new Error("Fresh remote image could not be downloaded and verified");
}

function registerNewsImageProtocol() {
  protocol.handle("lifeafter-news", async (request) => {
    const url = new URL(request.url); const id = decodeURIComponent(url.pathname.slice(1));
    if (url.hostname !== "image" || !/^[a-z0-9][a-z0-9._-]{2,127}$/.test(id)) return new Response("Invalid image ID", { status: 400 });
    const source = newsImageSource(id); if (!source) return new Response("Image not found", { status: 404 });
    const directory = join(dataRoot, "Cache", "news"); const dataFile = join(directory, `${id}.bin`); const typeFile = join(directory, `${id}.type`); const freshKey=`${id}:${source.sha256??source.url}`;
    if (freshNewsImageKeys.has(freshKey) && existsSync(dataFile) && existsSync(typeFile)) { const buffer=readFileSync(dataFile); if(cachedNewsImageMatches(buffer,source.sha256))return new Response(Uint8Array.from(buffer),{headers:{"content-type":readFileSync(typeFile,"utf8"),"cache-control":"no-store, no-cache, must-revalidate","pragma":"no-cache","expires":"0"}}); }
    const sourceUrl = new URL(source.url); if (sourceUrl.protocol !== "https:") return new Response("Untrusted image URL", { status: 403 });
    try {
      const {buffer,type}=await downloadFreshNewsImage(source);
      mkdirSync(directory, { recursive: true }); writeFileSync(dataFile, buffer); writeFileSync(typeFile, type, "utf8"); freshNewsImageKeys.add(freshKey); return new Response(Uint8Array.from(buffer), { headers: { "content-type": type, "cache-control": "no-store, no-cache, must-revalidate", "pragma":"no-cache", "expires":"0" } });
    } catch { return new Response("Remote image unavailable", { status: 502 }); }
  });
}

function resetNewsImageCache(): void {
  freshNewsImageKeys.clear();
  const directory=join(dataRoot,"Cache","news");
  if (!existsSync(directory)) return;
  for (const entry of readdirSync(directory,{withFileTypes:true})) {
    if (entry.isFile() && /^[a-z0-9][a-z0-9._-]{2,127}\.(bin|type)$/.test(entry.name)) {
      try { unlinkSync(join(directory,entry.name)); } catch { /* a fresh fetch remains mandatory even if cleanup fails */ }
    }
  }
}

async function synchronizePublicContentOnStartup(target: SqliteDatabase, databaseVersion: number): Promise<void> {
  const warnings: string[]=[];
  try {
    const manifest=await fetchLatestContentManifest((url,init)=>net.fetch(url,init),Date.now());
    await applyContentManifest(target,dataRoot,manifest,()=>{createBackup(target,dataRoot,app.getVersion(),databaseVersion,"upgrade");},net.fetch);
  } catch (error) {
    warnings.push(`公共资料清单同步失败：${error instanceof Error?error.stack??error.message:String(error)}`);
  }
  try {
    await refreshActivityCatalogOnLaunch(dataRoot,(url,init)=>net.fetch(url,init),`${Date.now()}-${randomUUID()}`);
  } catch(error) {
    warnings.push(`活动配置独立同步失败：${error instanceof Error?error.stack??error.message:String(error)}`);
  }
  const warningFile=join(dataRoot,"content-sync-warning.log");
  if(warnings.length)writeFileSync(warningFile,`${new Date().toISOString()} ${warnings.join("\n")}\n`,"utf8");
  else if(existsSync(warningFile))unlinkSync(warningFile);
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
      dataRoot,
    };
  });
  ipcMain.handle("reference:get-content", (event) => referenceContent(assertTrusted(event, "reference content")));
  ipcMain.handle("cookbook:set-unlock", (event, input: { id: string; unlocked: boolean }) => {
    const target = assertTrusted(event, "cookbook update");
    if (!/^recipe\.\d{4}$/.test(input.id)) throw new Error("食谱编号无效");
    target.prepare(`INSERT INTO cookbook_unlocks(recipe_id,unlocked,updated_at) VALUES (?,?,?) ON CONFLICT(recipe_id) DO UPDATE SET unlocked=excluded.unlocked,updated_at=excluded.updated_at`).run(input.id, input.unlocked ? 1 : 0, new Date().toISOString());
  });
  ipcMain.handle("settings:get", (event) => getSettings(assertTrusted(event, "settings")));
  ipcMain.handle("settings:set", (event, input: AppSettings) => setSettings(assertTrusted(event, "settings update"), input));
  ipcMain.handle("backups:list", (event) => listBackups(assertTrusted(event, "backup list"), dataRoot));
  ipcMain.handle("backups:create", (event) => createBackup(assertTrusted(event, "backup creation"), dataRoot, app.getVersion(), databaseVersion, "manual"));
  ipcMain.handle("backups:export", async (event, id: string) => {
    const target = assertTrusted(event, "backup export"); const source = backupPath(target, dataRoot, id); if (!source) throw new Error("找不到备份记录");
    const result = await dialog.showSaveDialog({ title: "导出备份副本", defaultPath: join(app.getPath("documents"), source.split(/[\\/]/).pop() ?? "assistant.backup.json"), filters: [{ name: "助手备份", extensions: ["json"] }] });
    if (!result.canceled && result.filePath) exportBackup(target, dataRoot, id, result.filePath);
    return { canceled: result.canceled };
  });
  ipcMain.handle("backups:restore", async (event) => {
    const target = assertTrusted(event, "backup restore"); const result = await dialog.showOpenDialog({ title: "选择备份文件", properties: ["openFile"], filters: [{ name: "助手备份", extensions: ["json"] }] });
    if (result.canceled || !result.filePaths[0]) return { canceled: true };
    const restored = restoreBackup(target, result.filePaths[0], () => { createBackup(target, dataRoot, app.getVersion(), databaseVersion, "pre-import"); });
    return { canceled: false, restored };
  });
  ipcMain.handle("migration:import-legacy", async (event) => {
    const target = assertTrusted(event, "legacy import"); const result = await dialog.showOpenDialog({ title: "选择旧版 xy.dat / JSON 数据", properties: ["openFile"], filters: [{ name: "旧版数据", extensions: ["dat", "json", "txt"] }] });
    if (result.canceled || !result.filePaths[0]) return { canceled: true };
    const ids = readBundledJson<CookbookDocument>("cookbook.json").recipes.map((recipe) => recipe.id);
    const report = importLegacyData(target, result.filePaths[0], ids, () => { createBackup(target, dataRoot, app.getVersion(), databaseVersion, "pre-import"); });
    return { canceled: false, report };
  });
  ipcMain.handle("runtime:open-data-folder", (event) => { assertTrusted(event, "data folder"); void shell.openPath(dataRoot); });
  ipcMain.handle("runtime:export-diagnostics", async (event) => {
    const target = assertTrusted(event, "diagnostics"); const diagnostics = [`明日之后养成助手诊断报告`, `生成时间：${new Date().toISOString()}`, `客户端版本：${app.getVersion()}`, `数据库版本：${databaseVersion}`, `平台：${process.platform} ${process.arch}`, `Electron：${process.versions.electron}`, `Node：${process.versions.node}`, `便携模式：${Boolean(portableDirectory)}`, `公共资料版本：${(target.prepare("SELECT version FROM content_releases ORDER BY applied_at DESC LIMIT 1").get() as {version?:string}|undefined)?.version ?? "未知"}`, `备份数量：${listBackups(target, dataRoot).length}`, `说明：本报告不包含售价、方案、食谱解锁状态或其他个人数据。`].join("\n");
    const result = await dialog.showSaveDialog({ title: "导出诊断报告", defaultPath: join(app.getPath("documents"), `assistant-diagnostics-${new Date().toISOString().slice(0,10)}.txt`), filters: [{ name: "文本", extensions: ["txt"] }] });
    if (!result.canceled && result.filePath) writeFileSync(result.filePath, diagnostics, "utf8"); return { canceled: result.canceled };
  });
  ipcMain.handle("updates:check", async (event, force = false) => {
    const target = assertTrusted(event, "update check"); const settings = getSettings(target); const now = Date.now();
    const readCheckTime = (key: string) => {
      const row = target.prepare("SELECT value_json AS valueJson FROM settings WHERE key=?").get(key) as { valueJson: string } | undefined;
      return row ? Number(JSON.parse(row.valueJson)) : 0;
    };
    const writeCheckTime = (key: string) => target.prepare(`INSERT INTO settings(key,value_json,updated_at) VALUES (?,?,?) ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json,updated_at=excluded.updated_at`).run(key, JSON.stringify(now), new Date(now).toISOString());
    const { clientCheckDue, contentCheckDue } = planUpdateChecks({ clientUpdateFrequency: settings.clientUpdateFrequency, lastClientCheck: readCheckTime("last-update-check"), now, manualClientCheck: force });
    if (!clientCheckDue && !contentCheckDue) return { skipped: true, message: "尚未到自动检查时间" };
    try {
      const manifest = await fetchLatestContentManifest((url,init)=>net.fetch(url,init),now);
      const contentUpdate = contentCheckDue ? await applyContentManifest(target, dataRoot, manifest, () => { createBackup(target, dataRoot, app.getVersion(), databaseVersion, "upgrade"); }, net.fetch) : { updated: false, contentVersion: manifest.contentVersion, packages: [] as string[] };
      if (clientCheckDue) writeCheckTime("last-update-check");
      const latest = manifest.clientUpdate.latestVersion; const current = app.getVersion(); const update = clientCheckDue && isClientVersionNewer(latest,current);
      const message = [clientCheckDue ? (update ? manifest.clientUpdate.message : "客户端已是最新版本") : "", contentUpdate.updated ? `公共资料已更新至 ${contentUpdate.contentVersion}` : (!clientCheckDue ? "公共资料已是最新版本" : "")].filter(Boolean).join("；");
      return { skipped: false, update, current, latest, policy: manifest.clientUpdate.updateLevel, minimumSupportedVersion: manifest.clientUpdate.minimumSupportedVersion, message, downloadPageUrl: manifest.clientUpdate.downloadPageUrl, contentVersion: manifest.contentVersion, contentUpdated: contentUpdate.updated };
    } catch (error) { if (force) throw new Error(`无法检查更新：${error instanceof Error ? error.message : String(error)}`); return { skipped: false, error: true, message: "自动检查失败，继续使用本地资料" }; }
  });
  ipcMain.handle("updates:open-download", (event, url: string) => { assertTrusted(event, "update download"); if (!isTrustedExternalUrl(url)) throw new Error("更新地址不在受信任的 GitHub 域名中"); void shell.openExternal(url); });
  ipcMain.handle("market:list-items", (event) => {
    if (!isTrustedRendererUrl(event.senderFrame?.url ?? "") || !database) {
      throw new Error("Rejected market request");
    }
    return listMarketItems(database);
  });
  ipcMain.handle("growth:get-content", (event) => {
    if (!isTrustedRendererUrl(event.senderFrame?.url ?? "")) throw new Error("Rejected growth request");
    try { const cached = readCachedContent<unknown>(dataRoot, "base-data"); if (cached) return baseDataPackageSchema.parse(cached).growth; } catch { /* fall back to bundled verified data */ }
    const directory = join(bundledContentDirectory(), "growth");
    const files = ["progression-legacy.json", "belt-legacy.json", "reference-legacy.json", "gene-legacy.json", "static-growth-legacy.json", "graph-legacy.json"];
    return Object.fromEntries(files.map((file) => [file.replace("-legacy.json", ""), JSON.parse(readFileSync(join(directory, file), "utf8"))]));
  });
  ipcMain.handle("growth:list-plans", (event) => {
    if (!isTrustedRendererUrl(event.senderFrame?.url ?? "") || !database) throw new Error("Rejected growth plan request");
    return database.prepare("SELECT id,name,plan_type AS planType,payload_json AS payloadJson,updated_at AS updatedAt FROM saved_plans WHERE plan_type LIKE 'growth:%' ORDER BY updated_at DESC").all().map((row) => {
      const value = row as Record<string, unknown>;
      return { id: String(value.id), name: String(value.name), planType: String(value.planType), payload: JSON.parse(String(value.payloadJson)), updatedAt: String(value.updatedAt) };
    });
  });
  ipcMain.handle("growth:save-plan", (event, input: { id?: string; name: string; module: string; payload: unknown }) => {
    if (!isTrustedRendererUrl(event.senderFrame?.url ?? "") || !database) throw new Error("Rejected growth plan save");
    const name = input.name.trim();
    if (!name || name.length > 200 || !/^[a-z-]{3,30}$/.test(input.module)) throw new Error("方案名称或模块无效");
    const payloadJson = JSON.stringify(input.payload);
    if (payloadJson.length > 1_000_000) throw new Error("方案数据过大");
    const id = input.id && /^[a-z0-9._-]{3,127}$/.test(input.id) ? input.id : `plan.growth.${randomUUID()}`;
    const now = new Date().toISOString();
    database.prepare(`INSERT INTO saved_plans(id,plan_type,name,payload_json,created_at,updated_at) VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET name=excluded.name,payload_json=excluded.payload_json,updated_at=excluded.updated_at`).run(id, `growth:${input.module}`, name, payloadJson, now, now);
    return id;
  });
  ipcMain.handle("growth:delete-plan", (event, id: string) => {
    if (!isTrustedRendererUrl(event.senderFrame?.url ?? "") || !database || !/^plan\.growth\.[a-z0-9-]+$/.test(id)) throw new Error("Rejected growth plan deletion");
    database.prepare("DELETE FROM saved_plans WHERE id=? AND plan_type LIKE 'growth:%'").run(id);
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

app.whenReady().then(async () => {
  assertWritableDataRoot();
  await session.defaultSession.clearCache();
  resetNewsImageCache();
  registerNewsImageProtocol();
  database = openDatabase(join(dataRoot, "assistant.sqlite"));
  const databaseVersion = migrateDatabase(database);
  installBundledContent(database);
  ensureAutomaticBackups(database, dataRoot, app.getVersion(), databaseVersion);
  await synchronizePublicContentOnStartup(database,databaseVersion);
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
