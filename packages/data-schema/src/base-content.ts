import { z } from "zod";

const contentVersionSchema = z.string().regex(/^\d{4}\.\d{2}\.\d{2}\.\d+$/);
const stableIdSchema = z.string().regex(/^[a-z0-9][a-z0-9._-]{2,127}$/);

export const marketCategorySchema = z.enum([
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
]);

export const marketItemSchema = z
  .object({
    id: stableIdSchema,
    name: z.string().trim().min(1).max(200),
    category: marketCategorySchema,
    legacyType: z.number().int().min(0).max(100),
    sortOrder: z.number().int().nonnegative(),
    level: z.number().int().min(0).max(1_000),
    couponCost: z.number().int().nonnegative(),
    legacyAliases: z.array(z.string().trim().min(1).max(200)).max(20).default([]),
    recipe: z
      .array(
        z
          .object({
            ingredientId: stableIdSchema,
            quantity: z.number().positive().max(1_000_000),
            defaultAcquisitionMode: z.enum(["craft", "purchase"]),
          })
          .strict(),
      )
      .max(100),
  })
  .strict();

export const marketCatalogSchema = z
  .object({
    schemaVersion: z.literal(1),
    contentVersion: contentVersionSchema,
    items: z.array(marketItemSchema).max(100_000),
    knownIssues: z
      .array(
        z
          .object({
            code: z.string().min(1),
            message: z.string().min(1),
            entityId: stableIdSchema.optional(),
          })
          .strict(),
      )
      .default([]),
  })
  .strict()
  .superRefine((catalog, context) => {
    const ids = new Set<string>();
    for (const [index, item] of catalog.items.entries()) {
      if (ids.has(item.id)) {
        context.addIssue({
          code: "custom",
          message: `Duplicate market item ID: ${item.id}`,
          path: ["items", index, "id"],
        });
      }
      ids.add(item.id);
    }
    for (const [itemIndex, item] of catalog.items.entries()) {
      for (const [ingredientIndex, ingredient] of item.recipe.entries()) {
        if (!ids.has(ingredient.ingredientId)) {
          context.addIssue({
            code: "custom",
            message: `Unknown ingredient ID: ${ingredient.ingredientId}`,
            path: ["items", itemIndex, "recipe", ingredientIndex, "ingredientId"],
          });
        }
      }
    }
  });

const nanoRangeSchema = z
  .object({
    min: z.number().nonnegative(),
    max: z.number().nonnegative(),
    average: z.number().nonnegative(),
  })
  .strict()
  .refine((range) => range.min <= range.average && range.average <= range.max, {
    message: "Nano average must be between min and max",
  });

export const nanoCatalogSchema = z
  .object({
    schemaVersion: z.literal(1),
    contentVersion: contentVersionSchema,
    items: z
      .array(
        z
          .object({
            itemId: stableIdSchema,
            nano1: nanoRangeSchema,
            nano2: nanoRangeSchema,
            nano3: nanoRangeSchema,
          })
          .strict(),
      )
      .max(100_000),
  })
  .strict();

export const cookbookCatalogSchema = z.object({
  schemaVersion: z.literal(1),
  contentVersion: contentVersionSchema,
  source: z.string().trim().min(1).max(500),
  recipes: z.array(z.object({
    id: stableIdSchema,
    position: z.number().int().nonnegative(),
    name: z.string().trim().min(1).max(200),
    method: z.string().max(2_000),
    effect: z.string().max(4_000),
    duration: z.string().max(200),
    defaultUnlocked: z.boolean(),
  }).strict()).max(10_000),
}).strict().superRefine((catalog, context) => {
  const ids = new Set<string>();
  for (const [index, recipe] of catalog.recipes.entries()) {
    if (ids.has(recipe.id)) context.addIssue({ code: "custom", message: `Duplicate cookbook recipe ID: ${recipe.id}`, path: ["recipes", index, "id"] });
    ids.add(recipe.id);
    if (recipe.position !== index) context.addIssue({ code: "custom", message: "Cookbook positions must remain contiguous", path: ["recipes", index, "position"] });
  }
});

export const baseDataPackageSchema = z.object({
  schemaVersion: z.literal(1),
  contentVersion: contentVersionSchema,
  market: marketCatalogSchema,
  nano: nanoCatalogSchema,
  cookbook: cookbookCatalogSchema,
  growth: z.record(z.string(), z.unknown()),
}).strict().superRefine((value, context) => {
  for (const [name, version] of [["market", value.market.contentVersion], ["nano", value.nano.contentVersion], ["cookbook", value.cookbook.contentVersion]] as const) {
    if (version !== value.contentVersion) context.addIssue({ code: "custom", message: `${name} content version does not match package`, path: [name, "contentVersion"] });
  }
});

export type MarketCatalog = z.infer<typeof marketCatalogSchema>;
export type NanoCatalog = z.infer<typeof nanoCatalogSchema>;
export type CookbookCatalog = z.infer<typeof cookbookCatalogSchema>;
export type BaseDataPackage = z.infer<typeof baseDataPackageSchema>;
