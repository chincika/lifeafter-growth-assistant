import { describe, expect, it } from "vitest";
import { calculateLegacyNanoMetrics } from "./legacy-nano-calculator.js";

describe("legacy nano calculator", () => {
  it("uses the displayed average for normal nano ratios", () => {
    expect(calculateLegacyNanoMetrics({ type: "nano1", average: 12.5, nano2Average: 0, couponCost: 10, processingGoldCost: 0, marketPrice: 25, convertNano3ProcessingCost: false })).toEqual({ amount: 12.5, effectiveCouponCost: 10, couponRatio: 1.25, purchaseRatio: 0.5 });
  });
  it("reproduces the 750 nano-II research click rule", () => {
    expect(calculateLegacyNanoMetrics({ type: "research", average: 0, nano2Average: 150, couponCost: 20, processingGoldCost: 0, marketPrice: 100, convertNano3ProcessingCost: false })).toEqual({ amount: 5, effectiveCouponCost: 20, couponRatio: 100, purchaseRatio: 20 });
  });
  it("converts processing gold at the original 0.425 branch for nano III only", () => {
    expect(calculateLegacyNanoMetrics({ type: "nano3", average: 50, nano2Average: 0, couponCost: 100, processingGoldCost: 42.5, marketPrice: 200, convertNano3ProcessingCost: true })).toEqual({ amount: 50, effectiveCouponCost: 200, couponRatio: 0.25, purchaseRatio: 0.25 });
  });
  it("returns zero ratios for missing denominators", () => {
    expect(calculateLegacyNanoMetrics({ type: "research", average: 0, nano2Average: 0, couponCost: 0, processingGoldCost: 0, marketPrice: null, convertNano3ProcessingCost: true })).toEqual({ amount: 0, effectiveCouponCost: 0, couponRatio: 0, purchaseRatio: 0 });
  });
});
