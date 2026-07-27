import { z } from "zod";

const MAX_LEGACY_TEXT_LENGTH = 32 * 1024 * 1024;

const legacyIngredientSchema = z
  .object({
    id: z.number().int().nonnegative().optional(),
    name: z.string().trim().min(1).max(200),
    num: z.number().nonnegative().max(1_000_000),
    exchangeable: z.boolean(),
  })
  .strip();

export const legacyPriceRecordSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    resType: z.number().int().min(0).max(100),
    resLevel: z.number().int().min(0).max(1_000),
    price: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
    coupon: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
    focus: z.boolean(),
    materialList: z.array(legacyIngredientSchema).max(100),
  })
  .strip();

export const legacyNanoRecordSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    nami_1_min: z.number().nonnegative(),
    nami_1_max: z.number().nonnegative(),
    nami_1_avg: z.number().nonnegative(),
    nami_2_min: z.number().nonnegative(),
    nami_2_max: z.number().nonnegative(),
    nami_2_avg: z.number().nonnegative(),
    nami_3_min: z.number().nonnegative(),
    nami_3_max: z.number().nonnegative(),
    nami_3_avg: z.number().nonnegative(),
  })
  .strip();

const legacyCookbookStateSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    unlock: z.boolean(),
  })
  .strip();

export const legacyArchiveDataSchema = z
  .object({
    ditan: z.array(legacyPriceRecordSchema).max(100_000).optional(),
    nano: z.array(legacyNanoRecordSchema).max(100_000).optional(),
    cookbook: z.array(legacyCookbookStateSchema).max(100_000).optional(),
    tupu_price: z.string().nullable().optional(),
    zj_price: z.string().nullable().optional(),
    tupu: z.record(z.string(), z.unknown()).optional(),
    gene: z.record(z.string(), z.unknown()).optional(),
  })
  .strip();

export type LegacyArchiveData = z.infer<typeof legacyArchiveDataSchema>;

const indexedDbRecordSchema = <T extends z.ZodType>(valueSchema: T) =>
  z.object({ type: z.string(), value: valueSchema }).strip();

const legacyIndexedDbDumpSchema = z
  .object({
    stores: z
      .object({
        prices: z.array(indexedDbRecordSchema(z.array(legacyPriceRecordSchema))),
        nano: z.array(indexedDbRecordSchema(z.array(legacyNanoRecordSchema))),
        cookbook: z.array(indexedDbRecordSchema(z.array(legacyCookbookStateSchema))),
      })
      .passthrough(),
  })
  .strip();

export interface LegacyEntityResolver {
  marketItemIdByName: ReadonlyMap<string, string>;
  cookbookIdByPosition?: readonly string[];
}

export interface LegacyMigrationPlan {
  itemStates: Array<{ entityId: string; marketPrice: number; focused: boolean }>;
  recipeChoices: Array<{
    productEntityId: string;
    ingredientEntityId: string;
    acquisitionMode: "craft" | "purchase";
    quantityOverride: number;
  }>;
  cookbookUnlocks: Array<{ recipeId: string; unlocked: boolean }>;
  unresolvedMarketItems: string[];
  unresolvedRecipeIngredients: Array<{ product: string; ingredient: string }>;
  invalidRecipeQuantities: Array<{
    product: string;
    ingredient: string;
    quantity: number;
  }>;
  unresolvedCookbookPositions: number[];
  preservedSections: Array<"nano" | "tupu_price" | "zj_price" | "tupu" | "gene">;
}

export function decodeLegacyDataText(text: string): LegacyArchiveData {
  if (text.length > MAX_LEGACY_TEXT_LENGTH) {
    throw new RangeError("Legacy data exceeds the 32 MiB encoded text limit");
  }

  let decoded: string;
  try {
    decoded = decodeURIComponent(text);
  } catch (error) {
    throw new Error("Legacy data is not valid URI-encoded text", { cause: error });
  }
  if (decoded.length > MAX_LEGACY_TEXT_LENGTH) {
    throw new RangeError("Legacy data exceeds the 32 MiB decoded JSON limit");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(decoded);
  } catch (error) {
    throw new Error("Legacy data does not contain valid JSON", { cause: error });
  }
  return legacyArchiveDataSchema.parse(parsed);
}

export function convertLegacyIndexedDbDump(input: unknown): LegacyArchiveData {
  const dump = legacyIndexedDbDumpSchema.parse(input);
  const prices = dump.stores.prices.find((record) => record.type === "地摊")?.value;
  const nano = dump.stores.nano.find((record) => record.type === "纳米")?.value;
  const cookbook = dump.stores.cookbook.find(
    (record) => record.type === "cookbook",
  )?.value;

  return legacyArchiveDataSchema.parse({
    ...(prices ? { ditan: prices } : {}),
    ...(nano ? { nano } : {}),
    ...(cookbook ? { cookbook } : {}),
  });
}

export function createLegacyMigrationPlan(
  data: LegacyArchiveData,
  resolver: LegacyEntityResolver,
): LegacyMigrationPlan {
  const itemStates: LegacyMigrationPlan["itemStates"] = [];
  const recipeChoices: LegacyMigrationPlan["recipeChoices"] = [];
  const cookbookUnlocks: LegacyMigrationPlan["cookbookUnlocks"] = [];
  const unresolvedMarketItems = new Set<string>();
  const unresolvedRecipeIngredients: LegacyMigrationPlan["unresolvedRecipeIngredients"] = [];
  const invalidRecipeQuantities: LegacyMigrationPlan["invalidRecipeQuantities"] = [];
  const unresolvedCookbookPositions: number[] = [];

  for (const item of data.ditan ?? []) {
    const productEntityId = resolver.marketItemIdByName.get(item.name);
    if (!productEntityId) {
      unresolvedMarketItems.add(item.name);
      continue;
    }
    itemStates.push({ entityId: productEntityId, marketPrice: item.price, focused: item.focus });

    for (const ingredient of item.materialList) {
      if (ingredient.num <= 0) {
        invalidRecipeQuantities.push({
          product: item.name,
          ingredient: ingredient.name,
          quantity: ingredient.num,
        });
        continue;
      }
      const ingredientEntityId = resolver.marketItemIdByName.get(ingredient.name);
      if (!ingredientEntityId) {
        unresolvedRecipeIngredients.push({ product: item.name, ingredient: ingredient.name });
        continue;
      }
      recipeChoices.push({
        productEntityId,
        ingredientEntityId,
        acquisitionMode: ingredient.exchangeable ? "craft" : "purchase",
        quantityOverride: ingredient.num,
      });
    }
  }

  for (const [position, recipe] of (data.cookbook ?? []).entries()) {
    const recipeId = resolver.cookbookIdByPosition?.[position];
    if (!recipeId) {
      unresolvedCookbookPositions.push(position);
      continue;
    }
    cookbookUnlocks.push({ recipeId, unlocked: recipe.unlock });
  }

  const preservedSections: LegacyMigrationPlan["preservedSections"] = [];
  for (const section of ["nano", "tupu_price", "zj_price", "tupu", "gene"] as const) {
    if (data[section] !== undefined) preservedSections.push(section);
  }

  return {
    itemStates,
    recipeChoices,
    cookbookUnlocks,
    unresolvedMarketItems: [...unresolvedMarketItems].sort(),
    unresolvedRecipeIngredients,
    invalidRecipeQuantities,
    unresolvedCookbookPositions,
    preservedSections,
  };
}
