import { describe, expect, it } from "vitest";

import {
  convertLegacyIndexedDbDump,
  createLegacyMigrationPlan,
  decodeLegacyDataText,
} from "./legacy-data.js";

const legacyData = {
  ditan: [
    {
      name: "生铁",
      resType: 5,
      resLevel: 1,
      price: 88,
      coupon: 0,
      focus: true,
      materialList: [
        { id: 1, name: "铁矿", num: 2, exchangeable: true },
        { id: 2, name: "木头", num: 4, exchangeable: false },
      ],
    },
  ],
  cookbook: [
    { name: "果酱", unlock: true },
    { name: "未知", unlock: false },
  ],
  gene: { human_gene: null },
};

describe("legacy migration", () => {
  it("decodes URI-encoded xy.dat content and strips unknown keys", () => {
    const decoded = decodeLegacyDataText(
      encodeURIComponent(JSON.stringify({ ...legacyData, unexpected: "ignored" })),
    );
    expect(decoded.ditan).toHaveLength(1);
    expect(decoded).not.toHaveProperty("unexpected");
  });

  it("maps prices, focus, recipe choices, and cookbook positions", () => {
    const plan = createLegacyMigrationPlan(legacyData, {
      marketItemIdByName: new Map([
        ["生铁", "item.pig-iron"],
        ["铁矿", "item.iron-ore"],
        ["木头", "item.wood"],
      ]),
      cookbookIdByPosition: ["recipe.jam", "recipe.unknown.1"],
    });

    expect(plan.itemStates).toEqual([
      { entityId: "item.pig-iron", marketPrice: 88, focused: true },
    ]);
    expect(plan.recipeChoices.map((choice) => choice.acquisitionMode)).toEqual([
      "craft",
      "purchase",
    ]);
    expect(plan.cookbookUnlocks).toEqual([
      { recipeId: "recipe.jam", unlocked: true },
      { recipeId: "recipe.unknown.1", unlocked: false },
    ]);
    expect(plan.preservedSections).toEqual(["gene"]);
  });

  it("reports unresolved references instead of guessing", () => {
    const plan = createLegacyMigrationPlan(legacyData, {
      marketItemIdByName: new Map([["生铁", "item.pig-iron"]]),
    });
    expect(plan.unresolvedRecipeIngredients).toEqual([
      { product: "生铁", ingredient: "铁矿" },
      { product: "生铁", ingredient: "木头" },
    ]);
    expect(plan.unresolvedCookbookPositions).toEqual([0, 1]);
  });

  it("reports zero-quantity legacy placeholders without importing the choice", () => {
    const withPlaceholder = structuredClone(legacyData);
    withPlaceholder.ditan[0]!.materialList[0]!.num = 0;
    const plan = createLegacyMigrationPlan(withPlaceholder, {
      marketItemIdByName: new Map([
        ["生铁", "item.pig-iron"],
        ["铁矿", "item.iron-ore"],
        ["木头", "item.wood"],
      ]),
    });
    expect(plan.invalidRecipeQuantities).toEqual([
      { product: "生铁", ingredient: "铁矿", quantity: 0 },
    ]);
    expect(plan.recipeChoices).toHaveLength(1);
  });

  it("rejects malformed records and invalid encoding", () => {
    expect(() => decodeLegacyDataText("%not-valid")).toThrow();
    expect(() =>
      decodeLegacyDataText(
        encodeURIComponent(JSON.stringify({ ditan: [{ name: "错误" }] })),
      ),
    ).toThrow();
  });

  it("converts the archived IndexedDB dump format", () => {
    const converted = convertLegacyIndexedDbDump({
      stores: {
        prices: [{ type: "地摊", value: legacyData.ditan }],
        nano: [{ type: "纳米", value: [] }],
        cookbook: [{ type: "cookbook", value: legacyData.cookbook }],
      },
    });
    expect(converted.ditan?.[0]?.name).toBe("生铁");
    expect(converted.cookbook).toHaveLength(2);
  });
});
