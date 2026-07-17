import { describe, expect, it } from "vitest";
import { compareContentVersions, resolveReleaseContentVersion, suggestContentVersion } from "./content-version.js";

describe("maintainer content versions", () => {
  it("suggests the first release for a new day", () => {
    expect(suggestContentVersion("2026.07.11.2", new Date(2026, 6, 17))).toBe("2026.07.17.1");
  });

  it("increments the serial for another release on the same day", () => {
    expect(suggestContentVersion("2026.07.17.3", new Date(2026, 6, 17))).toBe("2026.07.17.4");
  });

  it("automatically advances a duplicate or older requested version", () => {
    expect(resolveReleaseContentVersion("2026.07.11.2", "2026.07.17.3", new Date(2026, 6, 17))).toBe("2026.07.17.4");
    expect(compareContentVersions("2026.07.17.10", "2026.07.17.9")).toBeGreaterThan(0);
  });
});
