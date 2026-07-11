import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import {
  marketCatalogSchema,
  nanoCatalogSchema,
} from "../packages/data-schema/dist/index.js";
import { convertLegacyIndexedDbDump } from "../packages/migration/dist/index.js";

const inputPath = process.argv[2];
const outputDirectory = process.argv[3];
if (!inputPath || !outputDirectory) {
  throw new Error(
    "Usage: node tools/bootstrap-legacy-content.mjs <legacy-json> <output-directory>",
  );
}

const categoryByLegacyType = [
  "wood",
  "stone",
  "hemp",
  "animal",
  "special",
  "semi-finished",
  "armor",
  "shield",
  "hat",
  "blade",
  "bow",
  "shotgun",
  "smg",
  "assault-rifle",
  "sniper-rifle",
  "grenade-launcher",
  "flamethrower",
  "pistol",
  "melee-shield",
  "electromagnetic-gun",
  "drone",
  "consumable",
];

const dump = JSON.parse(await readFile(inputPath, "utf8"));
const legacy = convertLegacyIndexedDbDump(dump);
const legacyItems = legacy.ditan ?? [];
const itemIdByName = new Map(
  legacyItems.map((item) => [item.name, stableLegacyId("item", item.name)]),
);
const knownIssues = [];

const marketCatalog = marketCatalogSchema.parse({
  schemaVersion: 1,
  contentVersion: "2026.07.11.2",
  items: legacyItems.map((item, sortOrder) => ({
    id: itemIdByName.get(item.name),
    name: item.name,
    category: categoryByLegacyType[item.resType],
    legacyType: item.resType,
    sortOrder,
    level: item.resLevel,
    couponCost: item.coupon,
    legacyAliases: [item.name],
    recipe: item.materialList.flatMap((ingredient) => {
      const ingredientId = itemIdByName.get(ingredient.name);
      if (!ingredientId || ingredient.num <= 0) {
        knownIssues.push({
          code: ingredient.num <= 0 ? "ZERO_RECIPE_QUANTITY" : "MISSING_INGREDIENT",
          message: `${item.name} -> ${ingredient.name}: ${ingredient.num}`,
          entityId: itemIdByName.get(item.name),
        });
        return [];
      }
      return [
        {
          ingredientId,
          quantity: ingredient.num,
          defaultAcquisitionMode: ingredient.exchangeable ? "craft" : "purchase",
        },
      ];
    }),
  })),
  knownIssues,
});

const nanoCatalog = nanoCatalogSchema.parse({
  schemaVersion: 1,
  contentVersion: "2026.07.11.2",
  items: (legacy.nano ?? []).map((item) => ({
    itemId: itemIdByName.get(item.name),
    nano1: { min: item.nami_1_min, max: item.nami_1_max, average: item.nami_1_avg },
    nano2: { min: item.nami_2_min, max: item.nami_2_max, average: item.nami_2_avg },
    nano3: { min: item.nami_3_min, max: item.nami_3_max, average: item.nami_3_avg },
  })),
});

await mkdir(outputDirectory, { recursive: true });
await writeJson(join(outputDirectory, "market-items.json"), marketCatalog);
await writeJson(join(outputDirectory, "nano-items.json"), nanoCatalog);

console.log(
  JSON.stringify(
    {
      outputDirectory,
      marketItems: marketCatalog.items.length,
      recipes: marketCatalog.items.filter((item) => item.recipe.length > 0).length,
      nanoItems: nanoCatalog.items.length,
      knownIssues: marketCatalog.knownIssues,
    },
    null,
    2,
  ),
);

function stableLegacyId(prefix, name) {
  const hash = createHash("sha256").update(name.normalize("NFC"), "utf8").digest("hex");
  return `${prefix}.legacy.${hash.slice(0, 20)}`;
}

async function writeJson(path, value) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
