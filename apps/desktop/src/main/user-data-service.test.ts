import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { strToU8, zipSync } from "fflate";
import { migrateDatabase, openDatabase, type SqliteDatabase } from "@lifeafter-assistant/database";
import { createBackup, ensureAutomaticBackups, getSettings, importLegacyData, listBackups, restoreBackup, setSettings } from "./user-data-service.js";

let database: SqliteDatabase | undefined; const directories: string[] = [];
afterEach(() => { database?.close(); database = undefined; for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true }); });
function setup() { const directory = mkdtempSync(join(tmpdir(), "assistant-backup-")); directories.push(directory); database = openDatabase(":memory:"); const version = migrateDatabase(database); return { directory, version, database }; }
describe("desktop user data service", () => {
  it("round-trips every saved plan and setting through a checksummed backup", () => {
    const context = setup(); const now = new Date().toISOString();
    context.database.prepare("INSERT INTO saved_plans(id,plan_type,name,payload_json,created_at,updated_at) VALUES (?,?,?,?,?,?)").run("plan.growth.preserved", "growth:graph", "我的图谱", JSON.stringify({ graphTargetLevels: [2,3,4] }), now, now);
    setSettings(context.database, { theme: "light", clientUpdateFrequency: "monthly", contentAutoUpdate: false });
    const backup = createBackup(context.database, context.directory, "1.0.0", context.version, "manual");
    context.database.prepare("DELETE FROM saved_plans").run(); setSettings(context.database, { theme: "dark", clientUpdateFrequency: "daily", contentAutoUpdate: true });
    restoreBackup(context.database, join(context.directory, "Backups", backup.fileName), () => undefined);
    expect(context.database.prepare("SELECT name,payload_json AS payloadJson FROM saved_plans WHERE id='plan.growth.preserved'").get()).toEqual({ name: "我的图谱", payloadJson: JSON.stringify({ graphTargetLevels: [2,3,4] }) });
    expect(getSettings(context.database)).toEqual({ theme: "light", clientUpdateFrequency: "monthly", contentAutoUpdate: true });
  });
  it("rejects a modified backup before touching the database", () => {
    const context = setup(); const backup = createBackup(context.database, context.directory, "1.0.0", context.version, "manual"); const path = join(context.directory, "Backups", backup.fileName); const value = JSON.parse(readFileSync(path, "utf8")); value.appVersion = "tampered"; writeFileSync(path, JSON.stringify(value));
    expect(() => restoreBackup(context.database, path, () => { throw new Error("must not run"); })).toThrow("备份校验失败");
  });
  it("creates at most one daily and weekly automatic backup for the current period", () => {
    const context = setup(); ensureAutomaticBackups(context.database, context.directory, "1.0.0", context.version); ensureAutomaticBackups(context.database, context.directory, "1.0.0", context.version);
    const records = listBackups(context.database, context.directory); expect(records.filter((record) => record.backupType === "daily")).toHaveLength(1); expect(records.filter((record) => record.backupType === "weekly")).toHaveLength(1);
  });
  it("imports a bounded legacy ZIP containing xy.dat transactionally", () => {
    const context = setup(); const now = new Date().toISOString(); context.database.prepare("INSERT INTO public_entities(id,entity_type,name,payload_json,content_version,updated_at) VALUES ('item.wood','market-item','木头','{}','2026.07.17.1',?)").run(now);
    const encoded = encodeURIComponent(JSON.stringify({ ditan: [{ name: "木头", resType: 0, resLevel: 1, price: 321, coupon: 10, focus: true, materialList: [] }], cookbook: [{ name: "果酱", unlock: true }] }));
    const zipPath = join(context.directory, "legacy.zip"); writeFileSync(zipPath, zipSync({ "backup/xy.dat": strToU8(encoded) })); let protectedBackup = false;
    const report = importLegacyData(context.database, zipPath, ["recipe.0001"], () => { protectedBackup = true; });
    expect(protectedBackup).toBe(true); expect(report.importedPrices).toBe(1); expect(report.importedCookbook).toBe(1);
    expect(context.database.prepare("SELECT market_price,focused FROM user_item_state WHERE entity_id='item.wood'").get()).toEqual({ market_price: 321, focused: 1 });
  });
});
