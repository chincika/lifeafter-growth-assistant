import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const [releaseDirectoryArgument, version] = process.argv.slice(2);
if (!releaseDirectoryArgument || !/^\d{4}\.\d{2}\.\d{2}\.\d+$/.test(version ?? "")) {
  throw new Error("Usage: node tools/bump-release-content-version.mjs <release-directory> <YYYY.MM.DD.N>");
}

const releaseDirectory = resolve(releaseDirectoryArgument);
const readJson = (name) => JSON.parse(readFileSync(join(releaseDirectory, name), "utf8"));
const writeJson = (name, value) => {
  const buffer = Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
  writeFileSync(join(releaseDirectory, name), buffer);
  return buffer;
};

const manifest = readJson("content-manifest.json");
const packageBuffers = new Map();
for (const entry of manifest.packages) {
  const name = entry.kind === "base-data" ? "base-data.json" : `${entry.kind}.json`;
  const value = readJson(name);
  if (entry.kind === "base-data") {
    value.contentVersion = version;
    value.market.contentVersion = version;
    value.nano.contentVersion = version;
    value.cookbook.contentVersion = version;
  } else {
    value.version = version;
  }
  packageBuffers.set(entry.kind, writeJson(name, value));
}

const publishedAt = new Date().toISOString();
manifest.contentVersion = version;
manifest.publishedAt = publishedAt;
manifest.clientUpdate.effectiveAt = publishedAt;
for (const entry of manifest.packages) {
  const buffer = packageBuffers.get(entry.kind);
  entry.version = version;
  entry.sha256 = createHash("sha256").update(buffer).digest("hex");
  entry.sizeBytes = buffer.length;
}
writeJson("content-manifest.json", manifest);
console.log(JSON.stringify({ releaseDirectory, contentVersion: version, packages: manifest.packages.map(({ kind, sha256, sizeBytes }) => ({ kind, sha256, sizeBytes })) }, null, 2));
