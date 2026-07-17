import { contentManifestSchema, type ContentManifest } from "@lifeafter-assistant/data-schema";

export function retainUnchangedPackages(generated: ContentManifest, remote: ContentManifest | undefined): ContentManifest {
  if (!remote) return generated;
  const generatedKinds = new Set(generated.packages.map((entry) => entry.kind));
  return contentManifestSchema.parse({
    ...generated,
    packages: [
      ...generated.packages,
      ...remote.packages.filter((entry) => !generatedKinds.has(entry.kind)),
    ],
  });
}
