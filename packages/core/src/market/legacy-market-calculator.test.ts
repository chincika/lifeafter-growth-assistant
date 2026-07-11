import { describe, expect, it } from "vitest";

import {
  MarketDataError,
  calculateLegacyAcquisitionCost,
  calculateLegacyMarketEarnings,
  createLegacyMarketIndex,
} from "./legacy-market-calculator.js";
import type { LegacyMarketItem } from "./types.js";

const items: readonly LegacyMarketItem[] = [
  {
    name: "铁矿",
    resourceType: 1,
    resourceLevel: 1,
    marketPrice: 10,
    couponCost: 20,
    ingredients: [],
  },
  {
    name: "木材",
    resourceType: 0,
    resourceLevel: 1,
    marketPrice: 5,
    couponCost: 8,
    ingredients: [],
  },
  {
    name: "生铁",
    resourceType: 5,
    resourceLevel: 1,
    marketPrice: 100,
    couponCost: 0,
    ingredients: [
      { name: "铁矿", quantity: 2, expandRecipe: true },
      { name: "木材", quantity: 3, expandRecipe: false },
    ],
  },
];

describe("legacy market calculator", () => {
  it("reproduces recursive coupon and purchased-material cost behavior", () => {
    const index = createLegacyMarketIndex(items);

    expect(calculateLegacyAcquisitionCost("生铁", index)).toEqual({
      couponCost: 40,
      goldCost: 15,
    });
  });

  it("reproduces legacy tax rounding and coupon yield", () => {
    const index = createLegacyMarketIndex(items);
    const result = calculateLegacyMarketEarnings(items[2]!, index, {
      taxRate: 0.15,
      productionBonusPercent: 20,
    });

    expect(result).toEqual({
      afterTaxRevenue: 85,
      acquisition: { couponCost: 40, goldCost: 15 },
      netProfit: 70,
      couponYieldPercent: 175,
      expectedNetProfit: 87,
      expectedCouponYieldPercent: 217.5,
    });
  });

  it("rejects cycles instead of overflowing the call stack", () => {
    const cyclic: readonly LegacyMarketItem[] = [
      {
        name: "甲",
        resourceType: 5,
        resourceLevel: 1,
        marketPrice: 1,
        couponCost: 0,
        ingredients: [{ name: "乙", quantity: 1, expandRecipe: true }],
      },
      {
        name: "乙",
        resourceType: 5,
        resourceLevel: 1,
        marketPrice: 1,
        couponCost: 0,
        ingredients: [{ name: "甲", quantity: 1, expandRecipe: true }],
      },
    ];

    expect(() =>
      calculateLegacyAcquisitionCost("甲", createLegacyMarketIndex(cyclic)),
    ).toThrowError(MarketDataError);
  });

  it("rejects duplicate names in legacy data", () => {
    expect(() => createLegacyMarketIndex([...items, items[0]!])).toThrowError(
      expect.objectContaining({ code: "DUPLICATE_ITEM" }),
    );
  });
});
