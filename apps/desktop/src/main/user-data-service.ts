import { createHash, randomUUID } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";

import { createLegacyMigrationPlan, decodeLegacyDataText } from "@lifeafter-assistant/migration";
import type { SqliteDatabase } from "@lifeafter-assistant/database";
import { strFromU8, unzipSync } from "fflate";

export interface AppSettings {
  theme: "system" | "dark" | "light";
  clientUpdateFrequency: "launch" | "daily" | "weekly" | "monthly" | "never";
  contentAutoUpdate: boolean;
}
export const defaultSettings: AppSettings = { theme: "system", clientUpdateFrequency: "weekly", contentAutoUpdate: true };
const DATA_TABLES = ["user_item_state", "user_recipe_choices", "user_entities", "cookbook_unlocks", "saved_plans", "settings"] as const;
const TABLE_COLUMNS: Record<(typeof DATA_TABLES)[number], readonly string[]> = {
  user_item_state: ["entity_id", "market_price", "focused", "acquisition_mode", "payload_json", "updated_at"],
  user_recipe_choices: ["product_entity_id", "ingredient_entity_id", "acquisition_mode", "quantity_override", "updated_at"],
  user_entities: ["id", "entity_type", "name", "payload_json", "created_at", "updated_at"],
  cookbook_unlocks: ["recipe_id", "unlocked", "updated_at"],
  saved_plans: ["id", "plan_type", "name", "payload_json", "created_at", "updated_at"],
  settings: ["key", "value_json", "updated_at"],
};

function sha256(value: string | Buffer) { return createHash("sha256").update(value).digest("hex"); }
function settingValue(database: SqliteDatabase, key: string): unknown {
  const row = database.prepare("SELECT value_json AS valueJson FROM settings WHERE key=?").get(key) as { valueJson: string } | undefined;
  return row ? JSON.parse(row.valueJson) : undefined;
}
export function getSettings(database: SqliteDatabase): AppSettings {
  const value = settingValue(database, "app") as Partial<AppSettings> | undefined;
  return { ...defaultSettings, ...(value ?? {}), contentAutoUpdate: true };
}
export function setSettings(database: SqliteDatabase, settings: AppSettings) {
  const validated: AppSettings = {
    theme: ["system", "dark", "light"].includes(settings.theme) ? settings.theme : "system",
    clientUpdateFrequency: ["launch", "daily", "weekly", "monthly", "never"].includes(settings.clientUpdateFrequency) ? settings.clientUpdateFrequency : "weekly",
    contentAutoUpdate: true,
  };
  database.prepare(`INSERT INTO settings(key,value_json,updated_at) VALUES ('app',?,?) ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json,updated_at=excluded.updated_at`).run(JSON.stringify(validated), new Date().toISOString());
  return validated;
}

function backupDocument(database: SqliteDatabase, appVersion: string, databaseVersion: number) {
  const payload = {
    format: "lifeafter-assistant-backup",
    schemaVersion: 1,
    appVersion,
    databaseVersion,
    createdAt: new Date().toISOString(),
    tables: Object.fromEntries(DATA_TABLES.map((table) => [table, database.prepare(`SELECT * FROM ${table}`).all()])),
  };
  const payloadJson = JSON.stringify(payload);
  return { ...payload, sha256: sha256(payloadJson) };
}
export function createBackup(database: SqliteDatabase, dataRoot: string, appVersion: string, databaseVersion: number, backupType: "daily" | "weekly" | "upgrade" | "manual" | "pre-import") {
  const directory = join(dataRoot, "Backups"); mkdirSync(directory, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const fileName = `assistant-${backupType}-${stamp}.backup.json`;
  const filePath = join(directory, fileName);
  const document = backupDocument(database, appVersion, databaseVersion);
  const text = `${JSON.stringify(document, null, 2)}\n`; writeFileSync(filePath, text, "utf8");
  const id = `backup.${randomUUID()}`;
  database.prepare("INSERT INTO backup_history(id,backup_type,file_name,sha256,size_bytes,created_at,status) VALUES (?,?,?,?,?,?, 'available')").run(id, backupType, fileName, sha256(text), Buffer.byteLength(text), document.createdAt);
  pruneBackups(database, dataRoot);
  return { id, backupType, fileName, sha256: sha256(text), sizeBytes: Buffer.byteLength(text), createdAt: document.createdAt, status: "available" };
}
function pruneBackups(database: SqliteDatabase, dataRoot: string) {
  const limits: Record<string, number> = { daily: 7, weekly: 4, upgrade: 3, manual: 20, "pre-import": 5 };
  for (const [type, limit] of Object.entries(limits)) {
    const rows = database.prepare("SELECT id,file_name AS fileName FROM backup_history WHERE backup_type=? ORDER BY created_at DESC").all(type) as Array<{ id: string; fileName: string }>;
    for (const row of rows.slice(limit)) {
      const path = join(dataRoot, "Backups", row.fileName); if (existsSync(path)) unlinkSync(path);
      database.prepare("DELETE FROM backup_history WHERE id=?").run(row.id);
    }
  }
}
export function ensureAutomaticBackups(database: SqliteDatabase, dataRoot: string, appVersion: string, databaseVersion: number) {
  const now = new Date(); const day = now.toISOString().slice(0, 10);
  const dayExists = database.prepare("SELECT 1 FROM backup_history WHERE backup_type='daily' AND substr(created_at,1,10)=?").get(day);
  if (!dayExists) createBackup(database, dataRoot, appVersion, databaseVersion, "daily");
  const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - ((now.getUTCDay() + 6) % 7))).toISOString().slice(0, 10);
  const weekExists = database.prepare("SELECT 1 FROM backup_history WHERE backup_type='weekly' AND substr(created_at,1,10)>=?").get(monday);
  if (!weekExists) createBackup(database, dataRoot, appVersion, databaseVersion, "weekly");
}
export function listBackups(database: SqliteDatabase, dataRoot: string) {
  const rows = database.prepare("SELECT id,backup_type AS backupType,file_name AS fileName,sha256,size_bytes AS sizeBytes,created_at AS createdAt,status FROM backup_history ORDER BY created_at DESC").all() as Array<any>;
  return rows.map((row) => { const available = existsSync(join(dataRoot, "Backups", row.fileName)); if (!available && row.status === "available") database.prepare("UPDATE backup_history SET status='missing' WHERE id=?").run(row.id); return { ...row, status: available ? row.status : "missing" }; });
}
export function exportBackup(database: SqliteDatabase, dataRoot: string, id: string, targetPath: string) {
  const row = database.prepare("SELECT file_name AS fileName FROM backup_history WHERE id=?").get(id) as { fileName: string } | undefined;
  if (!row) throw new Error("找不到备份记录");
  const source = join(dataRoot, "Backups", row.fileName); if (!existsSync(source)) throw new Error("备份文件已经不存在");
  copyFileSync(source, targetPath);
}
export function restoreBackup(database: SqliteDatabase, filePath: string, beforeRestore: () => void) {
  if (statSync(filePath).size > 256 * 1024 * 1024) throw new Error("备份文件超过 256 MiB 限制");
  const document = JSON.parse(readFileSync(filePath, "utf8")) as Record<string, any>;
  if (document.format !== "lifeafter-assistant-backup" || document.schemaVersion !== 1 || typeof document.sha256 !== "string") throw new Error("不是受支持的备份文件");
  const { sha256: expected, ...payload } = document;
  if (sha256(JSON.stringify(payload)) !== expected) throw new Error("备份校验失败，文件可能已损坏或被修改");
  for (const table of DATA_TABLES) { if (!Array.isArray(document.tables?.[table])) throw new Error(`备份缺少数据表：${table}`); if (document.tables[table].length > 200_000) throw new Error(`备份数据表 ${table} 条目过多`); }
  beforeRestore();
  database.exec("BEGIN IMMEDIATE");
  try {
    for (const table of DATA_TABLES) database.exec(`DELETE FROM ${table}`);
    for (const table of DATA_TABLES) {
      const columns = TABLE_COLUMNS[table]; const placeholders = columns.map(() => "?").join(",");
      const statement = database.prepare(`INSERT INTO ${table}(${columns.join(",")}) VALUES (${placeholders})`);
      for (const row of document.tables[table]) statement.run(...columns.map((column) => row[column] ?? null));
    }
    database.exec("COMMIT");
  } catch (error) { database.exec("ROLLBACK"); throw error; }
  return { createdAt: document.createdAt, appVersion: document.appVersion, fileName: basename(filePath) };
}
export function importLegacyData(database: SqliteDatabase, filePath: string, cookbookIds: readonly string[], beforeImport: () => void) {
  if (statSync(filePath).size > 32 * 1024 * 1024) throw new Error("旧版数据文件超过 32 MiB 限制");
  const input = readFileSync(filePath); let encodedText: string;
  if (input[0] === 0x50 && input[1] === 0x4b) {
    if (input.length > 32 * 1024 * 1024) throw new Error("旧版 ZIP 超过 32 MiB 限制");
    let offset = 0, entries = 0, xySize = -1;
    while ((offset = input.indexOf(Buffer.from([0x50,0x4b,0x01,0x02]), offset)) >= 0) {
      if (offset + 46 > input.length) throw new Error("旧版 ZIP 中央目录不完整"); entries += 1; if (entries > 1_000) throw new Error("旧版 ZIP 文件条目过多");
      const uncompressed = input.readUInt32LE(offset + 24); const nameLength = input.readUInt16LE(offset + 28); const extraLength = input.readUInt16LE(offset + 30); const commentLength = input.readUInt16LE(offset + 32); const name = input.subarray(offset + 46, offset + 46 + nameLength).toString("utf8");
      if (uncompressed === 0xffffffff) throw new Error("不支持 ZIP64 旧版备份"); if (/(^|\/)xy\.dat$/i.test(name)) xySize = uncompressed;
      offset += 46 + nameLength + extraLength + commentLength;
    }
    if (xySize < 0) throw new Error("旧版 ZIP 中没有 xy.dat"); if (xySize > 32 * 1024 * 1024) throw new Error("旧版 xy.dat 解压后超过 32 MiB 限制");
    const files = unzipSync(input, { filter: (file) => /(^|\/)xy\.dat$/i.test(file.name) }); const entry = Object.entries(files).find(([name]) => /(^|\/)xy\.dat$/i.test(name)); if (!entry) throw new Error("无法读取旧版 xy.dat"); encodedText = strFromU8(entry[1]);
  } else encodedText = input.toString("utf8");
  const data = decodeLegacyDataText(encodedText);
  const entities = database.prepare(`SELECT id,name FROM public_entities WHERE entity_type='market-item' UNION ALL SELECT id,name FROM user_entities WHERE entity_type='market-item'`).all() as Array<{ id: string; name: string }>;
  const resolver = { marketItemIdByName: new Map(entities.map((item) => [item.name, item.id])), cookbookIdByPosition: cookbookIds };
  const plan = createLegacyMigrationPlan(data, resolver); beforeImport(); const now = new Date().toISOString();
  database.exec("BEGIN IMMEDIATE");
  try {
    const itemStatement = database.prepare(`INSERT INTO user_item_state(entity_id,market_price,focused,updated_at) VALUES (?,?,?,?) ON CONFLICT(entity_id) DO UPDATE SET market_price=excluded.market_price,focused=excluded.focused,updated_at=excluded.updated_at`);
    for (const item of plan.itemStates) itemStatement.run(item.entityId, item.marketPrice, item.focused ? 1 : 0, now);
    const recipeStatement = database.prepare(`INSERT INTO user_recipe_choices(product_entity_id,ingredient_entity_id,acquisition_mode,quantity_override,updated_at) VALUES (?,?,?,?,?) ON CONFLICT(product_entity_id,ingredient_entity_id) DO UPDATE SET acquisition_mode=excluded.acquisition_mode,quantity_override=excluded.quantity_override,updated_at=excluded.updated_at`);
    for (const choice of plan.recipeChoices) recipeStatement.run(choice.productEntityId, choice.ingredientEntityId, choice.acquisitionMode, choice.quantityOverride, now);
    const cookbookStatement = database.prepare(`INSERT INTO cookbook_unlocks(recipe_id,unlocked,updated_at) VALUES (?,?,?) ON CONFLICT(recipe_id) DO UPDATE SET unlocked=excluded.unlocked,updated_at=excluded.updated_at`);
    for (const recipe of plan.cookbookUnlocks) cookbookStatement.run(recipe.recipeId, recipe.unlocked ? 1 : 0, now);
    const preserved = { nano: data.nano, tupu_price: data.tupu_price, zj_price: data.zj_price, tupu: data.tupu, gene: data.gene };
    database.prepare(`INSERT INTO settings(key,value_json,updated_at) VALUES ('legacy-import-preserved',?,?) ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json,updated_at=excluded.updated_at`).run(JSON.stringify(preserved), now);
    database.exec("COMMIT");
  } catch (error) { database.exec("ROLLBACK"); throw error; }
  return { importedPrices: plan.itemStates.length, importedRecipeChoices: plan.recipeChoices.length, importedCookbook: plan.cookbookUnlocks.length, unresolvedMarketItems: plan.unresolvedMarketItems.length, preservedSections: plan.preservedSections };
}
export function backupPath(database: SqliteDatabase, dataRoot: string, id: string) {
  const row = database.prepare("SELECT file_name AS fileName FROM backup_history WHERE id=?").get(id) as { fileName: string } | undefined;
  return row ? join(dataRoot, "Backups", row.fileName) : undefined;
}
export function fileInfo(path: string) { const stat = statSync(path); return { path, size: stat.size, modifiedAt: stat.mtime.toISOString() }; }
