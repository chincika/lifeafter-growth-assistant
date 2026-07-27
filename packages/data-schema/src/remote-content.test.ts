import { describe, expect, it } from "vitest";

import {
  activityEntrySchema,
  contentManifestSchema,
  newsEntrySchema,
} from "./remote-content.js";

const sha256 = "a".repeat(64);

describe("remote content schemas", () => {
  it("accepts a complete versioned content manifest", () => {
    const result = contentManifestSchema.safeParse({
      schemaVersion: 1,
      contentVersion: "2026.07.11.1",
      publishedAt: "2026-07-11T10:00:00+08:00",
      minimumClientVersion: "0.1.0",
      clientUpdate: {
        latestVersion: "0.1.0",
        minimumSupportedVersion: "0.1.0",
        updateLevel: "optional",
        message: "初始版本",
        downloadPageUrl: "https://github.com/chincika/lifeafter-growth-assistant/releases",
        effectiveAt: "2026-07-11T10:00:00+08:00",
        graceDays: 7,
      },
      packages: [
        {
          kind: "base-data",
          version: "2026.07.11.1",
          url: "https://github.com/example/base-data.zip",
          sha256,
          sizeBytes: 1024,
        },
      ],
    });

    expect(result.success).toBe(true);
  });

  it("rejects insecure URLs and malformed checksums", () => {
    expect(
      newsEntrySchema.safeParse({
        id: "news.2026-07-11.1",
        title: "测试快报",
        publishedAt: "2026-07-11T10:00:00+08:00",
        image: {
          url: "http://example.com/news.png",
          sha256: "bad",
          sizeBytes: 100,
          width: 1080,
          height: 10_000,
        },
      }).success,
    ).toBe(false);
  });

  it("rejects activity ranges ending before they start", () => {
    expect(
      activityEntrySchema.safeParse({
        id: "activity.test.1",
        category: "activity.test",
        title: "测试活动",
        startDate: "2026-07-12",
        endDate: "2026-07-11",
      }).success,
    ).toBe(false);
  });

  it("rejects duplicate package kinds", () => {
    const base = {
      schemaVersion: 1,
      contentVersion: "2026.07.11.1",
      publishedAt: "2026-07-11T10:00:00+08:00",
      minimumClientVersion: "0.1.0",
      clientUpdate: {
        latestVersion: "0.1.0",
        minimumSupportedVersion: "0.1.0",
        updateLevel: "optional",
        message: "测试",
        downloadPageUrl: "https://github.com/example/releases",
        effectiveAt: "2026-07-11T10:00:00+08:00",
        graceDays: 7,
      },
    };
    const entry = {
      kind: "news",
      version: "2026.07.11.1",
      url: "https://github.com/example/news.zip",
      sha256,
      sizeBytes: 100,
    };

    expect(
      contentManifestSchema.safeParse({
        ...base,
        packages: [entry, entry],
      }).success,
    ).toBe(false);
  });
});
