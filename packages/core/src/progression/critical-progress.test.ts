import { describe, expect, it } from "vitest";

import {
  calculateExpectedClicks,
  calculateExpectedClicksForLevels,
  normalizeCriticalProgressProbabilities,
} from "./critical-progress.js";

describe("critical progress", () => {
  it("uses one click per progress when no critical progress is possible", () => {
    expect(
      calculateExpectedClicks(12, {
        bonus1Percent: 0,
        bonus4Percent: 0,
        bonus9Percent: 0,
      }),
    ).toBe(12);
  });

  it("handles guaranteed critical progress and target overshoot exactly", () => {
    expect(
      calculateExpectedClicks(11, {
        bonus1Percent: 100,
        bonus4Percent: 0,
        bonus9Percent: 0,
      }),
    ).toBe(6);
    expect(
      calculateExpectedClicks(11, {
        bonus1Percent: 0,
        bonus4Percent: 0,
        bonus9Percent: 100,
      }),
    ).toBe(2);
  });

  it("returns an exact expectation for mixed outcomes", () => {
    expect(
      calculateExpectedClicks(2, {
        bonus1Percent: 50,
        bonus4Percent: 0,
        bonus9Percent: 0,
      }),
    ).toBe(1.5);
  });

  it("rejects invalid probability totals instead of creating negatives", () => {
    expect(() =>
      normalizeCriticalProgressProbabilities({
        bonus1Percent: 80,
        bonus4Percent: 80,
        bonus9Percent: 0,
      }),
    ).toThrowError(RangeError);
  });

  it("supports levels where critical progress is disabled", () => {
    expect(
      calculateExpectedClicksForLevels(
        [2, 2],
        { bonus1Percent: 100, bonus4Percent: 0, bonus9Percent: 0 },
        new Set([1]),
      ),
    ).toBe(3);
  });
});
