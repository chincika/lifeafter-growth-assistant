import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import { activityCatalogSchema, type ActivityCatalog } from "@lifeafter-assistant/data-schema";
import { cachedContentFile, versionedRemoteUrl } from "./content-update-service.js";

type ContentFetcher = (input: string, init?: RequestInit) => Promise<Response>;

const repository = "chincika/lifeafter-growth-assistant";
const apiUrl = `https://api.github.com/repos/${repository}/contents/releases/activities.json?ref=main`;
const rawUrl = `https://raw.githubusercontent.com/${repository}/main/releases/activities.json`;
const maximumActivityBytes = 8 * 1024 * 1024;

export interface DownloadedActivityCatalog {
  catalog: ActivityCatalog;
  buffer: Buffer;
  source: "github-api" | "github-raw";
}

function parseActivityBuffer(buffer: Buffer) {
  if (buffer.length < 1 || buffer.length > maximumActivityBytes) {
    throw new Error("活动配置文件大小异常");
  }
  let value: unknown;
  try {
    value = JSON.parse(buffer.toString("utf8"));
  } catch {
    throw new Error("活动配置不是有效 JSON");
  }
  return activityCatalogSchema.parse(value);
}

function decodeGithubContents(value: unknown) {
  if (!value || typeof value !== "object") throw new Error("GitHub 活动配置响应无效");
  const payload = value as { encoding?: unknown; content?: unknown };
  if (payload.encoding !== "base64" || typeof payload.content !== "string") {
    throw new Error("GitHub 活动配置响应缺少内容");
  }
  return Buffer.from(payload.content.replace(/\s/g, ""), "base64");
}

export async function fetchLatestActivityCatalog(
  fetcher: ContentFetcher,
  launchNonce: string | number = Date.now(),
): Promise<DownloadedActivityCatalog> {
  try {
    const response = await fetcher(versionedRemoteUrl(apiUrl, launchNonce), {
      cache: "no-store",
      headers: { Accept: "application/vnd.github+json" },
      signal: AbortSignal.timeout(15_000),
    });
    if (response.ok) {
      const buffer = decodeGithubContents(await response.json());
      return { catalog: parseActivityBuffer(buffer), buffer, source: "github-api" };
    }
  } catch {
    // The public Contents API has a rate limit. Raw remains an HTTPS fallback.
  }

  const response = await fetcher(versionedRemoteUrl(rawUrl, launchNonce), {
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`活动配置下载失败：HTTP ${response.status}`);
  const announced = Number(response.headers.get("content-length") ?? 0);
  if (announced > maximumActivityBytes) throw new Error("活动配置文件大小异常");
  const buffer = Buffer.from(await response.arrayBuffer());
  return { catalog: parseActivityBuffer(buffer), buffer, source: "github-raw" };
}

function hash(value: Buffer) {
  return createHash("sha256").update(value).digest("hex");
}

export function storeLatestActivityCatalog(dataRoot: string, downloaded: DownloadedActivityCatalog) {
  const target = cachedContentFile(dataRoot, "activities");
  if (existsSync(target) && hash(readFileSync(target)) === hash(downloaded.buffer)) return false;
  mkdirSync(dirname(target), { recursive: true });
  const temporary = `${target}.startup.tmp`;
  writeFileSync(temporary, downloaded.buffer);
  renameSync(temporary, target);
  return true;
}

export async function refreshActivityCatalogOnLaunch(
  dataRoot: string,
  fetcher: ContentFetcher,
  launchNonce: string | number = Date.now(),
) {
  const downloaded = await fetchLatestActivityCatalog(fetcher, launchNonce);
  return {
    updated: storeLatestActivityCatalog(dataRoot, downloaded),
    version: downloaded.catalog.version,
    entries: downloaded.catalog.entries.length,
    source: downloaded.source,
  };
}
