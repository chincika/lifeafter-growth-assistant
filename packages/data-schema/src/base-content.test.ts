import { describe, expect, it } from "vitest";

import { marketCatalogSchema, nanoCatalogSchema } from "./base-content.js";

describe("base content schemas", () => {
  it("accepts stable market references", () => {
    const result = marketCatalogSchema.safeParse({
      schemaVersion: 1,
      contentVersion: "2026.07.11.1",
      items: [
        {
          id: "item.iron-ore",
          name: "铁矿",
          category: "stone",
          legacyType: 1,
          sortOrder: 0,
          level: 1,
          couponCost: 30,
          legacyAliases: [],
          recipe: [],
        },
        {
          id: "item.pig-iron",
          name: "生铁",
          category: "semi-finished",
          legacyType: 5,
          sortOrder: 1,
          level: 1,
          couponCost: 0,
          legacyAliases: [],
          recipe: [
            {
              ingredientId: "item.iron-ore",
              quantity: 2,
              defaultAcquisitionMode: "craft",
            },
          ],
        },
      ],
      knownIssues: [],
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing ingredient IDs", () => {
    const result = marketCatalogSchema.safeParse({
      schemaVersion: 1,
      contentVersion: "2026.07.11.1",
      items: [
        {
          id: "item.test",
          name: "测试",
          category: "special",
          legacyType: 4,
          sortOrder: 0,
          level: 1,
          couponCost: 0,
          recipe: [
            {
              ingredientId: "item.missing",
              quantity: 1,
              defaultAcquisitionMode: "purchase",
            },
          ],
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("rejects inconsistent nano ranges", () => {
    expect(
      nanoCatalogSchema.safeParse({
        schemaVersion: 1,
        contentVersion: "2026.07.11.1",
        items: [
          {
            itemId: "item.test",
            nano1: { min: 1, max: 2, average: 3 },
            nano2: { min: 0, max: 0, average: 0 },
            nano3: { min: 0, max: 0, average: 0 },
          },
        ],
      }).success,
    ).toBe(false);
  });
});
