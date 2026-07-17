import { describe, expect, it } from "vitest";
import { contentManifestSchema } from "@lifeafter-assistant/data-schema";
import { retainUnchangedPackages } from "./release-manifest.js";

const packageEntry = (kind: "base-data" | "activities" | "news", version: string) => ({ kind, version, url: `https://raw.githubusercontent.com/example/example/main/releases/${kind}.json`, sha256: ({"base-data":"a",activities:"b",news:"c"} as const)[kind].repeat(64), sizeBytes: 10 });
const manifest = (version: string, packages: ReturnType<typeof packageEntry>[]) => contentManifestSchema.parse({schemaVersion:1,contentVersion:version,publishedAt:"2026-07-17T00:00:00.000Z",minimumClientVersion:"0.1.0",clientUpdate:{latestVersion:"0.1.1",minimumSupportedVersion:"0.1.0",updateLevel:"optional",message:"test",downloadPageUrl:"https://github.com/example/example/releases",effectiveAt:"2026-07-17T00:00:00.000Z",graceDays:0},packages});

describe("maintainer release manifest", () => {
  it("retains remote news when publishing activity data only", () => {
    const merged = retainUnchangedPackages(
      manifest("2026.07.17.2", [packageEntry("base-data", "2026.07.17.2"), packageEntry("activities", "2026.07.17.2")]),
      manifest("2026.07.17.1", [packageEntry("base-data", "2026.07.17.1"), packageEntry("activities", "2026.07.17.1"), packageEntry("news", "2026.07.17.1")]),
    );
    expect(merged.packages.map((entry) => [entry.kind, entry.version])).toEqual([
      ["base-data", "2026.07.17.2"],
      ["activities", "2026.07.17.2"],
      ["news", "2026.07.17.1"],
    ]);
  });

  it("uses the newly generated package instead of retaining the same kind", () => {
    const merged = retainUnchangedPackages(
      manifest("2026.07.17.2", [packageEntry("news", "2026.07.17.2")]),
      manifest("2026.07.17.1", [packageEntry("news", "2026.07.17.1")]),
    );
    expect(merged.packages).toHaveLength(1);
    expect(merged.packages[0]?.version).toBe("2026.07.17.2");
  });
});
