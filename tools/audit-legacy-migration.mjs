import { readFile } from "node:fs/promises";

import { convertLegacyIndexedDbDump } from "../packages/migration/dist/index.js";

const inputPath = process.argv[2];
if (!inputPath) {
  throw new Error("Usage: node tools/audit-legacy-migration.mjs <legacy-json-path>");
}

const parsed = JSON.parse(await readFile(inputPath, "utf8"));
const converted = convertLegacyIndexedDbDump(parsed);
const marketItems = converted.ditan ?? [];
const marketNames = new Set(marketItems.map((item) => item.name));
const missingIngredients = [];
const invalidRecipeQuantities = [];

for (const item of marketItems) {
  for (const ingredient of item.materialList) {
    if (ingredient.num <= 0) {
      invalidRecipeQuantities.push({
        product: item.name,
        ingredient: ingredient.name,
        quantity: ingredient.num,
      });
    }
    if (!marketNames.has(ingredient.name)) {
      missingIngredients.push({ product: item.name, ingredient: ingredient.name });
    }
  }
}

console.log(
  JSON.stringify(
    {
      marketItems: marketItems.length,
      marketItemsWithRecipes: marketItems.filter((item) => item.materialList.length > 0)
        .length,
      nanoItems: converted.nano?.length ?? 0,
      cookbookStates: converted.cookbook?.length ?? 0,
      duplicateMarketNames:
        marketItems.length - new Set(marketItems.map((item) => item.name)).size,
      missingIngredients,
      invalidRecipeQuantities,
    },
    null,
    2,
  ),
);
