import { describe, expect, it } from "vitest";

import { planUpdateChecks } from "./update-check-policy.js";

describe("desktop update check policy", () => {
  it("checks public content on every launch even when client checks are disabled", () => {
    expect(planUpdateChecks({
      clientUpdateFrequency: "never",
      lastClientCheck: Date.now(),
      now: Date.now(),
      manualClientCheck: false,
    })).toEqual({ clientCheckDue: false, contentCheckDue: true });
  });

  it("keeps the configured client cadence independent from launch content checks", () => {
    const now = Date.now();
    expect(planUpdateChecks({
      clientUpdateFrequency: "weekly",
      lastClientCheck: now - 60_000,
      now,
      manualClientCheck: false,
    })).toEqual({ clientCheckDue: false, contentCheckDue: true });
    expect(planUpdateChecks({
      clientUpdateFrequency: "launch",
      lastClientCheck: now,
      now,
      manualClientCheck: false,
    })).toEqual({ clientCheckDue: true, contentCheckDue: true });
  });

  it("uses the manual action only for a client-version check", () => {
    expect(planUpdateChecks({
      clientUpdateFrequency: "monthly",
      lastClientCheck: Date.now(),
      now: Date.now(),
      manualClientCheck: true,
    })).toEqual({ clientCheckDue: true, contentCheckDue: false });
  });
});
