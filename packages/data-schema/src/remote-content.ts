import { z } from "zod";

const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/i, "Expected a SHA-256 hash");
const versionSchema = z.string().regex(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/);
const contentVersionSchema = z.string().regex(/^\d{4}\.\d{2}\.\d{2}\.\d+$/);
const stableIdSchema = z.string().regex(/^[a-z0-9][a-z0-9._-]{2,127}$/);
const dateOnlySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const httpsUrlSchema = z.url().refine((url) => new URL(url).protocol === "https:", {
  message: "Remote content must use HTTPS",
});

export const updateLevelSchema = z.enum(["optional", "recommended", "required"]);

export const clientUpdatePolicySchema = z
  .object({
    latestVersion: versionSchema,
    minimumSupportedVersion: versionSchema,
    updateLevel: updateLevelSchema,
    message: z.string().trim().min(1).max(2_000),
    downloadPageUrl: httpsUrlSchema,
    effectiveAt: z.iso.datetime({ offset: true }),
    graceDays: z.number().int().min(0).max(90),
  })
  .strict();

export const contentPackageSchema = z
  .object({
    kind: z.enum(["base-data", "news", "activities", "assets"]),
    version: contentVersionSchema,
    url: httpsUrlSchema,
    sha256: sha256Schema,
    sizeBytes: z.number().int().positive().max(512 * 1024 * 1024),
  })
  .strict();

export const contentManifestSchema = z
  .object({
    schemaVersion: z.literal(1),
    contentVersion: contentVersionSchema,
    publishedAt: z.iso.datetime({ offset: true }),
    minimumClientVersion: versionSchema,
    clientUpdate: clientUpdatePolicySchema,
    packages: z.array(contentPackageSchema).min(1).max(16),
  })
  .strict()
  .superRefine((manifest, context) => {
    const kinds = new Set<string>();
    for (const [index, entry] of manifest.packages.entries()) {
      if (kinds.has(entry.kind)) {
        context.addIssue({
          code: "custom",
          message: `Duplicate content package kind: ${entry.kind}`,
          path: ["packages", index, "kind"],
        });
      }
      kinds.add(entry.kind);
    }
  });

export const newsEntrySchema = z
  .object({
    id: stableIdSchema,
    title: z.string().trim().min(1).max(120),
    publishedAt: z.iso.datetime({ offset: true }),
    image: z
      .object({
        url: httpsUrlSchema,
        sha256: sha256Schema,
        sizeBytes: z.number().int().positive().max(64 * 1024 * 1024),
        width: z.number().int().positive().max(20_000),
        height: z.number().int().positive().max(100_000),
      })
      .strict(),
    withdrawn: z.boolean().default(false),
    expiresAt: z.iso.datetime({ offset: true }).optional(),
  })
  .strict();

export const newsCatalogSchema = z
  .object({
    schemaVersion: z.literal(1),
    version: contentVersionSchema,
    entries: z.array(newsEntrySchema).max(1_000),
  })
  .strict();

export const activityEntrySchema = z
  .object({
    id: stableIdSchema,
    category: stableIdSchema,
    title: z.string().trim().min(1).max(120),
    startDate: dateOnlySchema,
    endDate: dateOnlySchema.optional(),
    description: z.string().trim().max(2_000).optional(),
    sourceUrl: httpsUrlSchema.optional(),
    withdrawn: z.boolean().default(false),
  })
  .strict()
  .superRefine((activity, context) => {
    if (activity.endDate && activity.endDate < activity.startDate) {
      context.addIssue({
        code: "custom",
        message: "Activity endDate must not precede startDate",
        path: ["endDate"],
      });
    }
  });

export const activityCatalogSchema = z
  .object({
    schemaVersion: z.literal(1),
    version: contentVersionSchema,
    entries: z.array(activityEntrySchema).max(10_000),
  })
  .strict();

export type ClientUpdatePolicy = z.infer<typeof clientUpdatePolicySchema>;
export type ContentManifest = z.infer<typeof contentManifestSchema>;
export type NewsCatalog = z.infer<typeof newsCatalogSchema>;
export type ActivityCatalog = z.infer<typeof activityCatalogSchema>;
