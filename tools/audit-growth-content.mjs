import { readFile } from "node:fs/promises";
import { join } from "node:path";

const directory = process.argv[2] ?? "content/base/growth";
const load = async (name) =>
  JSON.parse(await readFile(join(directory, name), "utf8"));
const progression = (await load("progression-legacy.json")).exports;
const belt = (await load("belt-legacy.json")).exports;
const gene = (await load("gene-legacy.json")).declarations;
const graph = (await load("graph-legacy.json")).declarations;
const staticData = (await load("static-growth-legacy.json")).declarations;

assert(Object.keys(progression).length === 55, "progression export count");
assert(
  progression.m.length === 30 && progression.n.length === 30,
  "research level count",
);
for (const key of [
  "z",
  "a",
  "b",
  "c",
  "d",
  "e",
  "f",
  "g",
  "h",
  "i",
  "j",
  "k",
  "l",
])
  assert(progression[key].length === 31, `research attributes ${key}`);
for (const [key, count] of [
  ["P", 5],
  ["Q", 10],
  ["R", 15],
  ["S", 20],
  ["T", 25],
  ["U", 30],
  ["V", 35],
])
  assert(progression[key].length === count, `mastery levels ${key}`);
assert(belt.a.length === 42 && belt.d.length === 28, "belt chip counts");
for (const chip of [...belt.a, ...belt.d])
  for (let level = 1; level <= 12; level += 1) {
    const values = chip[`attr_${level}`];
    assert(Array.isArray(values), `${chip.name} level ${level}`);
    assert(
      (chip.attr.match(/#\d+#/g) ?? []).length === values.length,
      `${chip.name} placeholder count level ${level}`,
    );
  }
for (const key of ["A", "o", "p", "q", "r", "t", "u", "v", "w", "x", "y"])
  assert(progression[key]?.length === 36, `mastery attributes ${key}`);
for (const key of [
  "E_0",
  "N_0",
  "T_0",
  "U_0",
  "z_0",
  "B_0",
  "V_0",
  "Zt_0",
  "el_0",
  "al_0",
  "tl_0",
  "ll_0",
  "nl_0",
  "sl_0",
])
  assert(gene[key]?.type, `gene tier ${key}`);
for (const key of ["ye_0", "he_0", "ze_0", "be_0", "ke_0", "je_0", "we_0"])
  assert(graph[key].length === 9, `graph ${key}`);
assert(
  graph.Ce_0.length === 7 && graph.Ue_0.length === 7 && graph.Ee_0.length === 5,
  "graph progression tables",
);
assert(staticData.Xl_0.length === 37, "reformation stage count");
for (let index = 1; index < staticData.Xl_0.length; index += 1)
  assert(
    staticData.Xl_0[index].level.reduce((sum, value) => sum + value, 0) >=
      staticData.Xl_0[index - 1].level.reduce((sum, value) => sum + value, 0),
    "reformation order",
  );
console.log(
  JSON.stringify(
    {
      researchLevels: 30,
      masteryLevels: 35,
      beltChips: 70,
      geneTiers: 14,
      graphTypes: 7,
      graphEquipment: [
        "Qe_0",
        "Ke_0",
        "We_0",
        "Ye_0",
        "Xe_0",
        "Ze_0",
        "ea_0",
      ].reduce((sum, key) => sum + graph[key].length, 0),
      reformationStages: 37,
    },
    null,
    2,
  ),
);
function assert(condition, label) {
  if (!condition) throw new Error(`Growth content audit failed: ${label}`);
}
