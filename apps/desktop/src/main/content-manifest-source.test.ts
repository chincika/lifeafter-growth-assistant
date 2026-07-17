import { describe, expect, it, vi } from "vitest";
import { fetchLatestContentManifest } from "./content-manifest-source.js";

const manifest = {
  schemaVersion: 1,
  contentVersion: "2026.07.17.8",
  publishedAt: "2026-07-17T09:00:00.000Z",
  minimumClientVersion: "0.1.0",
  clientUpdate: {
    latestVersion: "0.1.2",
    minimumSupportedVersion: "0.1.0",
    updateLevel: "optional",
    message: "test",
    downloadPageUrl: "https://github.com/chincika/lifeafter-growth-assistant/releases",
    effectiveAt: "2026-07-17T09:00:00.000Z",
    graceDays: 7,
  },
  packages: [{
    kind: "base-data",
    version: "2026.07.17.8",
    url: "https://raw.githubusercontent.com/chincika/lifeafter-growth-assistant/main/releases/base-data.json",
    sha256: "a".repeat(64),
    sizeBytes: 1,
  }],
};

describe("content manifest source", () => {
  it("prefers the uncached GitHub Contents API", async () => {
    const encoded = Buffer.from(JSON.stringify(manifest)).toString("base64");
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ encoding: "base64", content: encoded }), { status: 200 }));
    const result = await fetchLatestContentManifest(fetcher, 123);
    expect(result.contentVersion).toBe("2026.07.17.8");
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(String(fetcher.mock.calls[0]?.[0])).toContain("api.github.com/repos/chincika/lifeafter-growth-assistant/contents/releases/content-manifest.json?ref=main&v=123");
  });

  it("falls back to GitHub Raw when the API is unavailable", async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response("rate limited", { status: 403 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(manifest), { status: 200 }));
    const result = await fetchLatestContentManifest(fetcher, 456);
    expect(result.clientUpdate.latestVersion).toBe("0.1.2");
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(String(fetcher.mock.calls[1]?.[0])).toContain("raw.githubusercontent.com/chincika/lifeafter-growth-assistant/main/releases/content-manifest.json?v=456");
  });
});
