import { describe, expect, it } from "vitest";
import { calculateExpectedGeneClicks, calculateProgressionCosts, calculateReformationCosts, calculateUpgradeRange, simulateProgress } from "./calculators.js";

describe("growth calculators", () => {
  it("sums only the requested upgrade interval", () => expect(calculateUpgradeRange([10, 15, 20, 30], 2, 5)).toEqual({ levels: 3, total: 65 }));
  it("calculates deterministic and exact expected progression costs", () => {
    const result = calculateProgressionCosts([{ progress: 10, materialsPerClick: { nano1: 300 } }], { bonus1Percent: 15, bonus4Percent: 10, bonus9Percent: 5 });
    expect(result.deterministicMaterials.nano1).toBe(3000);
    expect(result.expectedClicks).toBeLessThan(10);
    expect(result.expectedMaterials.nano1).toBeCloseTo(result.expectedClicks * 300);
  });
  it("disables critical progress on marked levels", () => expect(calculateProgressionCosts([{ progress: 5, materialsPerClick: {}, criticalAllowed: false }], { bonus1Percent: 100, bonus4Percent: 0, bonus9Percent: 0 }).expectedClicks).toBe(5));
  it("uses exact gene expectation", () => expect(calculateExpectedGeneClicks(10, 0, 0)).toBe(10));
  it("rejects invalid gene probabilities", () => expect(() => calculateExpectedGeneClicks(10, 70, 40)).toThrow(RangeError));
  it("includes reformation promotion clicks and costs", () => expect(calculateReformationCosts([{ clicks: 20, moleculePerClick: 20, nano3PerClick: 0, goldPerClick: 500, promotionMolecule: 20, promotionNano3: 0, promotionGold: 500 }])).toEqual({ clicks: 21, molecule: 420, nano3: 0, gold: 10500 }));
  it("replays a simulation from its seed", () => {
    const outcomes = [{ progress: 1, percent: 70, label: "normal" }, { progress: 2, percent: 30, label: "critical" }];
    expect(simulateProgress(100, outcomes, "same-seed")).toEqual(simulateProgress(100, outcomes, "same-seed"));
  });
});
