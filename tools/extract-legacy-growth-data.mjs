import { readFile, writeFile, mkdir } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { join } from "node:path";
import { parse } from "@babel/parser";

const assetDirectory = process.argv[2];
const outputDirectory = process.argv[3];
if (!assetDirectory || !outputDirectory) throw new Error("Usage: extract-legacy-growth-data <asset-directory> <output-directory>");

const progression = await import(pathToFileURL(join(assetDirectory, "DcKjsNnC.js")).href);
const belt = await import(pathToFileURL(join(assetDirectory, "et4flEzZ.js")).href);
const reference = await import(pathToFileURL(join(assetDirectory, "6dzoHprQ.js")).href);
const gene = await extractLiteralDeclarations(join(assetDirectory, "MTAGc61d.js"));
const staticPages = await extractLiteralDeclarations(join(assetDirectory, "4T5dfKTZ.js"));
const graph = await extractLiteralDeclarations(join(assetDirectory, "dWWV9JFQ.js"));
await mkdir(outputDirectory, { recursive: true });
await writeJson(join(outputDirectory, "progression-legacy.json"), { schemaVersion: 1, exports: progression });
await writeJson(join(outputDirectory, "belt-legacy.json"), { schemaVersion: 1, exports: belt });
await writeJson(join(outputDirectory, "reference-legacy.json"), { schemaVersion: 1, exports: reference });
await writeJson(join(outputDirectory, "gene-legacy.json"), { schemaVersion: 1, declarations: gene });
await writeJson(join(outputDirectory, "static-growth-legacy.json"), { schemaVersion: 1, declarations: staticPages });
await writeJson(join(outputDirectory, "graph-legacy.json"), { schemaVersion: 1, declarations: graph });
console.log(JSON.stringify({ progressionExports: Object.keys(progression).length, beltExports: Object.keys(belt).length, referenceExports: Object.keys(reference).length, geneDeclarations: Object.keys(gene).length, staticDeclarations: Object.keys(staticPages).length, graphDeclarations: Object.keys(graph).length }, null, 2));

async function extractLiteralDeclarations(path) {
  const ast = parse(await readFile(path, "utf8"), { sourceType: "module" });
  const output = {}; const counts = new Map();
  visit(ast, (node) => {
    if (node.type !== "VariableDeclarator" || node.id?.type !== "Identifier") return;
    try {
      const value = literal(node.init);
      const json = JSON.stringify(value);
      if (json.length < 120) return;
      const count = counts.get(node.id.name) ?? 0; counts.set(node.id.name, count + 1);
      output[`${node.id.name}_${count}`] = value;
    } catch { /* Expressions and rendered VNodes are intentionally ignored. */ }
  });
  return output;
}
function visit(value, callback, seen = new Set()) {
  if (!value || typeof value !== "object" || seen.has(value)) return;
  seen.add(value); callback(value);
  for (const child of Object.values(value)) if (Array.isArray(child)) child.forEach((item) => visit(item, callback, seen)); else visit(child, callback, seen);
}
function literal(node) {
  if (!node) throw new Error("missing");
  if (node.type === "StringLiteral" || node.type === "NumericLiteral" || node.type === "BooleanLiteral") return node.value;
  if (node.type === "NullLiteral") return null;
  if (node.type === "UnaryExpression" && node.operator === "!") return !literal(node.argument);
  if (node.type === "UnaryExpression" && node.operator === "-") return -literal(node.argument);
  if (node.type === "ArrayExpression") return node.elements.map(literal);
  if (node.type === "ObjectExpression") return Object.fromEntries(node.properties.map((property) => {
    if (property.type !== "ObjectProperty" || property.computed) throw new Error("property");
    const key = property.key.type === "Identifier" ? property.key.name : String(literal(property.key));
    return [key, literal(property.value)];
  }));
  throw new Error(node.type);
}
async function writeJson(path, value) { await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8"); }
