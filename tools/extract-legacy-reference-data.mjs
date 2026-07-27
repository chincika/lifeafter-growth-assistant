import { parse } from "@babel/parser";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

const legacyRoot = resolve(
  process.argv[2] ?? "../明日之后养成助手-legacy-archive-20260711",
);
const outputRoot = resolve(process.argv[3] ?? "content/base");

function literalValue(node) {
  if (["StringLiteral", "NumericLiteral", "BooleanLiteral"].includes(node.type)) {
    return node.value;
  }
  if (node.type === "NullLiteral") return null;
  if (node.type === "ArrayExpression") return node.elements.map(literalValue);
  if (node.type === "ObjectExpression") {
    return Object.fromEntries(
      node.properties.map((property) => [
        property.key.name ?? property.key.value,
        literalValue(property.value),
      ]),
    );
  }
  if (node.type === "UnaryExpression" && node.argument.type === "NumericLiteral") {
    if (node.operator === "-") return -node.argument.value;
    if (node.operator === "+") return node.argument.value;
    if (node.operator === "!") return !node.argument.value;
  }
  throw new TypeError(`Unsupported legacy literal: ${node.type}`);
}

async function topLevelArrays(file) {
  const source = await readFile(file, "utf8");
  const ast = parse(source, { sourceType: "module" });
  const result = new Map();
  for (const statement of ast.program.body) {
    if (statement.type !== "VariableDeclaration") continue;
    for (const declaration of statement.declarations) {
      if (
        declaration.id.type === "Identifier" &&
        declaration.init?.type === "ArrayExpression"
      ) {
        result.set(declaration.id.name, literalValue(declaration.init));
      }
    }
  }
  return result;
}

function plainText(value) {
  return String(value ?? "")
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .trim();
}

function dateOnly(value) {
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(String(value ?? ""));
  return match?.[1];
}

async function writeJson(file, value) {
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

const assets = join(legacyRoot, "web", "assets");
const shared = await topLevelArrays(join(assets, "bVpvKCYN.js"));
const schedules = await topLevelArrays(join(assets, "6dzoHprQ.js"));

const cookbook = shared.get("P");
if (!Array.isArray(cookbook) || cookbook.length !== 566) {
  throw new Error("Legacy cookbook array was not found or changed unexpectedly");
}

await writeJson(join(outputRoot, "cookbook.json"), {
  schemaVersion: 1,
  contentVersion: "2026.06.11.1",
  source: "archived application data",
  recipes: cookbook.map((recipe, index) => ({
    id: `recipe.${String(index + 1).padStart(4, "0")}`,
    position: index,
    name: plainText(recipe.name),
    method: plainText(recipe.method),
    effect: plainText(recipe.effect),
    duration: plainText(recipe.duration),
    defaultUnlocked: Boolean(recipe.unlock),
  })),
});

const categoryArrays = ["e", "n", "t", "s", "d", "b", "a", "p"];
const categoryNames = [
  "辐射高校",
  "配方合成半价",
  "腰带芯片打折",
  "拟态赛季",
  "冻雪危局",
  "寻宝夺金",
  "装备改造特惠",
  "营地时代",
];

const activities = categoryArrays.flatMap((variable, categoryIndex) => {
  const entries = schedules.get(variable) ?? [];
  return entries.map((entry, index) => ({
    id: `activity.${variable}.${String(index + 1).padStart(3, "0")}`,
    category: `activity-category.${variable}`,
    categoryName: categoryNames[categoryIndex],
    title: plainText(entry.season ?? entry.era ?? entry.version ?? categoryNames[categoryIndex]),
    version: plainText(entry.version),
    condition: plainText(entry.condition),
    floors: Number.isFinite(entry.floors) ? entry.floors : null,
    startDate: dateOnly(entry.start),
    endDate: dateOnly(entry.end),
    rawStart: plainText(entry.start),
    rawEnd: plainText(entry.end),
  }));
});

await writeJson(join(outputRoot, "activities.json"), {
  schemaVersion: 1,
  contentVersion: "2026.06.11.1",
  categories: categoryArrays.map((id, index) => ({
    id: `activity-category.${id}`,
    name: categoryNames[index],
    sortOrder: index,
  })),
  entries: activities,
});

const news = schedules.get("r");
if (!Array.isArray(news)) throw new Error("Legacy survivor news history was not found");
await writeJson(join(outputRoot, "survivor-news.json"), {
  schemaVersion: 1,
  contentVersion: "2026.06.11.1",
  enabled: false,
  entries: news.map((entry, index) => ({
    id: `news.${String(index + 1).padStart(4, "0")}`,
    publishedDate: dateOnly(entry.date),
    title: `${plainText(entry.date)} 幸存者快报`,
    imageUrl: String(entry.url),
  })),
});

console.log(
  JSON.stringify({ cookbook: cookbook.length, activities: activities.length, news: news.length }),
);
