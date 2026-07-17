import { contentManifestSchema, type ContentManifest } from "@lifeafter-assistant/data-schema";
import { versionedRemoteUrl } from "./content-update-service.js";

type ContentFetcher = (input: string, init?: RequestInit) => Promise<Response>;
const repository = "chincika/lifeafter-growth-assistant";
const apiUrl = `https://api.github.com/repos/${repository}/contents/releases/content-manifest.json?ref=main`;
const rawUrl = `https://raw.githubusercontent.com/${repository}/main/releases/content-manifest.json`;

function decodeGithubContents(value: unknown): unknown {
  if (!value || typeof value !== "object") throw new Error("GitHub 内容响应无效");
  const payload = value as { encoding?: unknown; content?: unknown };
  if (payload.encoding !== "base64" || typeof payload.content !== "string") throw new Error("GitHub 内容响应缺少清单");
  return JSON.parse(Buffer.from(payload.content.replace(/\s/g, ""), "base64").toString("utf8"));
}

export async function fetchLatestContentManifest(fetcher: ContentFetcher, now = Date.now()): Promise<ContentManifest> {
  try {
    const response = await fetcher(versionedRemoteUrl(apiUrl, now), {
      cache: "no-store",
      headers: { Accept: "application/vnd.github+json" },
      signal: AbortSignal.timeout(10_000),
    });
    if (response.ok) return contentManifestSchema.parse(decodeGithubContents(await response.json()));
  } catch {
    // GitHub API has an unauthenticated rate limit. Raw remains a safe fallback.
  }
  const response = await fetcher(versionedRemoteUrl(rawUrl, now), { cache: "no-store", signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return contentManifestSchema.parse(await response.json());
}
