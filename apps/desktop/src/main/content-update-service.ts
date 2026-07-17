import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import type { SqliteDatabase } from "@lifeafter-assistant/database";
import { activityCatalogSchema, baseDataPackageSchema, newsCatalogSchema, type ContentManifest } from "@lifeafter-assistant/data-schema";

function hash(value: Buffer | string) { return createHash("sha256").update(value).digest("hex"); }
type ContentFetcher = (input: string, init?: RequestInit) => Promise<Response>;
export function cachedContentFile(dataRoot: string, kind: string) { return join(dataRoot, "Content", `${kind}.json`); }
export function readCachedContent<T>(dataRoot: string, kind: string): T | undefined {
  const path = cachedContentFile(dataRoot, kind); return existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) as T : undefined;
}
async function downloadPackage(entry: ContentManifest["packages"][number], fetcher: ContentFetcher) {
  const response = await fetcher(entry.url, { signal: AbortSignal.timeout(30_000) }); if (!response.ok) throw new Error(`${entry.kind} 下载失败：HTTP ${response.status}`);
  const announced = Number(response.headers.get("content-length") ?? 0); if (announced > entry.sizeBytes || announced > 512 * 1024 * 1024) throw new Error(`${entry.kind} 文件大小异常`);
  const buffer = Buffer.from(await response.arrayBuffer()); if (buffer.length !== entry.sizeBytes) throw new Error(`${entry.kind} 实际大小与清单不符`); if (hash(buffer).toLowerCase() !== entry.sha256.toLowerCase()) throw new Error(`${entry.kind} SHA-256 校验失败`);
  let parsed: unknown; try { parsed = JSON.parse(buffer.toString("utf8")); } catch { throw new Error(`${entry.kind} 不是有效 JSON 资料包`); }
  if (entry.kind === "base-data") return { entry, parsed: baseDataPackageSchema.parse(parsed), buffer };
  if (entry.kind === "news") return { entry, parsed: newsCatalogSchema.parse(parsed), buffer };
  if (entry.kind === "activities") return { entry, parsed: activityCatalogSchema.parse(parsed), buffer };
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("assets 资料包必须是 JSON 对象");
  return { entry, parsed, buffer };
}
export function applyBaseDataPackage(database: SqliteDatabase, value: ReturnType<typeof baseDataPackageSchema.parse>) {
  const insert = database.prepare(`INSERT INTO public_entities(id,entity_type,name,payload_json,content_version,updated_at) VALUES (?, 'market-item', ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET entity_type=excluded.entity_type,name=excluded.name,payload_json=excluded.payload_json,content_version=excluded.content_version,updated_at=excluded.updated_at`);
  const nano = new Map(value.nano.items.map((item) => [item.itemId, item])); const now = new Date().toISOString();
  for (const item of value.market.items) insert.run(item.id, item.name, JSON.stringify({ ...item, nano: nano.get(item.id) ?? null }), value.contentVersion, now);
}
export async function applyContentManifest(database: SqliteDatabase, dataRoot: string, manifest: ContentManifest, beforeApply: () => void, fetcher: ContentFetcher = fetch) {
  const existing = database.prepare("SELECT 1 FROM content_releases WHERE version=?").get(manifest.contentVersion);
  if (existing && manifest.packages.every((entry) => existsSync(cachedContentFile(dataRoot, entry.kind)))) return { updated: false, contentVersion: manifest.contentVersion, packages: [] as string[] };
  const downloaded = [];
  for (const entry of manifest.packages) downloaded.push(await downloadPackage(entry, fetcher));
  beforeApply(); mkdirSync(join(dataRoot, "Content"), { recursive: true }); database.exec("BEGIN IMMEDIATE");
  try {
    for (const item of downloaded) if (item.entry.kind === "base-data") applyBaseDataPackage(database, item.parsed as ReturnType<typeof baseDataPackageSchema.parse>);
    database.prepare("INSERT INTO content_releases(version,applied_at,manifest_sha256) VALUES (?,?,?) ON CONFLICT(version) DO UPDATE SET applied_at=excluded.applied_at,manifest_sha256=excluded.manifest_sha256").run(manifest.contentVersion, new Date().toISOString(), hash(JSON.stringify(manifest)));
    database.exec("COMMIT");
  } catch (error) { database.exec("ROLLBACK"); throw error; }
  try {
    for (const item of downloaded) { const target = cachedContentFile(dataRoot, item.entry.kind); const temporary = `${target}.tmp`; writeFileSync(temporary, item.buffer); renameSync(temporary, target); }
  } catch (error) { throw new Error(`资料已写入数据库，但缓存文件保存失败：${String(error)}`); }
  return { updated: true, contentVersion: manifest.contentVersion, packages: downloaded.map((item) => item.entry.kind) };
}
