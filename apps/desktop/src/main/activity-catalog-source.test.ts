import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";
import { cachedContentFile } from "./content-update-service.js";
import {
  fetchLatestActivityCatalog,
  refreshActivityCatalogOnLaunch,
} from "./activity-catalog-source.js";

const temporaryDirectories: string[] = [];
afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

const catalog = (title: string) => ({
  schemaVersion: 1,
  version: "2026.07.17.14",
  entries: [
    {
      id: "activity.belt.199",
      category: "belt-discount",
      title,
      startDate: "2026-07-16",
      endDate: "2026-07-30",
      description: "8 芯片",
    },
  ],
});

const apiResponse = (title: string) =>
  new Response(
    JSON.stringify({
      encoding: "base64",
      content: Buffer.from(JSON.stringify(catalog(title))).toString("base64"),
    }),
    { status: 200 },
  );

describe("activity catalog startup refresh", () => {
  it("requests the uncached GitHub Contents API on every launch", async () => {
    const fetcher = vi
      .fn<(input: string, init?: RequestInit) => Promise<Response>>()
      .mockResolvedValueOnce(apiResponse("第一次启动"))
      .mockResolvedValueOnce(apiResponse("第二次启动"));

    const first = await fetchLatestActivityCatalog(fetcher, "launch-one");
    const second = await fetchLatestActivityCatalog(fetcher, "launch-two");

    expect(first.catalog.entries[0]?.title).toBe("第一次启动");
    expect(second.catalog.entries[0]?.title).toBe("第二次启动");
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls[0]![0]).toContain("v=launch-one");
    expect(fetcher.mock.calls[1]![0]).toContain("v=launch-two");
    expect(fetcher.mock.calls[0]![1]?.cache).toBe("no-store");
    expect(fetcher.mock.calls[1]![1]?.cache).toBe("no-store");
  });

  it("replaces a changed activity file even when its version was reused", async () => {
    const dataRoot = mkdtempSync(join(tmpdir(), "lifeafter-activities-"));
    temporaryDirectories.push(dataRoot);
    const fetcher = vi
      .fn<(input: string, init?: RequestInit) => Promise<Response>>()
      .mockResolvedValueOnce(apiResponse("旧活动内容"))
      .mockResolvedValueOnce(apiResponse("新活动内容"));

    const first = await refreshActivityCatalogOnLaunch(dataRoot, fetcher, "one");
    const second = await refreshActivityCatalogOnLaunch(dataRoot, fetcher, "two");
    const stored = JSON.parse(readFileSync(cachedContentFile(dataRoot, "activities"), "utf8"));

    expect(first.updated).toBe(true);
    expect(second.updated).toBe(true);
    expect(stored.version).toBe("2026.07.17.14");
    expect(stored.entries[0].title).toBe("新活动内容");
  });

  it("falls back to a cache-busted Raw request", async () => {
    const fetcher = vi
      .fn<(input: string, init?: RequestInit) => Promise<Response>>()
      .mockResolvedValueOnce(new Response("rate limited", { status: 403 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify(catalog("Raw 最新内容")), { status: 200 }),
      );

    const result = await fetchLatestActivityCatalog(fetcher, "raw-launch");

    expect(result.source).toBe("github-raw");
    expect(result.catalog.entries[0]?.title).toBe("Raw 最新内容");
    expect(fetcher.mock.calls[1]![0]).toContain("v=raw-launch");
    expect(fetcher.mock.calls[1]![1]?.cache).toBe("no-store");
  });

  it("never stores an invalid remote activity configuration", async () => {
    const dataRoot = mkdtempSync(join(tmpdir(), "lifeafter-activities-"));
    temporaryDirectories.push(dataRoot);
    const fetcher = vi
      .fn<(input: string, init?: RequestInit) => Promise<Response>>()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            encoding: "base64",
            content: Buffer.from("not-json").toString("base64"),
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(new Response("still-invalid", { status: 200 }));

    await expect(
      refreshActivityCatalogOnLaunch(dataRoot, fetcher, "invalid"),
    ).rejects.toThrow("不是有效 JSON");
    expect(() => readFileSync(cachedContentFile(dataRoot, "activities"))).toThrow();
  });
});
