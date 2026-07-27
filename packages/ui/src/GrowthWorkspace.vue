<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue";
import {
  calculateExpectedGeneClicks,
  calculateProgressionCosts,
  calculateReformationCosts,
  calculateUpgradeRange,
  simulateProgress,
  type ProgressionCostResult,
  type SimulationResult,
} from "@lifeafter-assistant/core";

type Material = { name: string; num: number; saleable?: boolean };
type ProgressLevel = {
  level: number;
  times: number;
  goldbar?: number;
  consumables: Material[];
};
type AttributeLevel = { level: number; attr: string };
type GeneTier = {
  type: string;
  attr_section: Array<{
    id: number;
    name: string;
    attr: string;
    single_bar_score: number;
    single_bar_value: number;
    percentage: boolean;
  }>;
  score_attr: Array<{
    limit_score: number;
    attrs: Array<{ attr: string; value: number }>;
  }>;
  attr_section_consumables: Array<{
    active: { cond: { name: string; num: number }; score: number };
    single: { cond: { name: string; num: number }; score: number };
  }>;
  key_section?: {
    name: string;
    attr: Array<{
      consumables?: { name: string; num: number };
      limit_score?: number;
      description: string;
    }>;
  };
};
type GraphLevel = {
  id: number;
  exp: number;
  up: string;
  attrs: Array<{ attr: string; value: number; percentage: boolean }>;
};
type ReformationRow = {
  level: number[];
  molecule: number;
  nano: number;
  goldbar: number;
  times: number;
};
type BeltChip = {
  name: string;
  type: string;
  level: string;
  attr: string;
  [key: string]: unknown;
};

type GrowthPlan = {
  id: string;
  name: string;
  planType: string;
  payload: Record<string, unknown>;
  updatedAt: string;
};
const props = defineProps<{
  content: Record<string, unknown>;
  plans: GrowthPlan[];
}>();
const emit = defineEmits<{
  savePlan: [
    input: { name: string; module: string; payload: Record<string, unknown> },
  ];
  deletePlan: [id: string];
}>();
const tabs = [
  ["research", "专研 / 升星"],
  ["mastery", "专精"],
  ["accessory", "配件等级"],
  ["belt", "腰带芯片"],
  ["graph", "图谱养成"],
  ["human", "人类基因"],
  ["half", "半感染基因"],
  ["reformation", "装备改造"],
] as const;
const active = ref<(typeof tabs)[number][0]>("research");
const progression = computed(
  () =>
    (props.content.progression as { exports?: Record<string, unknown> })
      ?.exports ?? {},
);
const gene = computed(
  () =>
    (props.content.gene as { declarations?: Record<string, unknown> })
      ?.declarations ?? {},
);
const belt = computed(
  () =>
    (props.content.belt as { exports?: Record<string, unknown> })?.exports ??
    {},
);
const graph = computed(
  () =>
    (props.content.graph as { declarations?: Record<string, unknown> })
      ?.declarations ?? {},
);
const staticData = computed(
  () =>
    (
      props.content["static-growth"] as {
        declarations?: Record<string, unknown>;
      }
    )?.declarations ?? {},
);

const from = ref(0),
  to = ref(30),
  researchKind = ref<"version" | "evolution">("version");
const bonus1 = ref(15),
  bonus4 = ref(10),
  bonus9 = ref(5);
const simulationSeed = ref("lifeafter-plan-1"),
  researchSimulation = ref<SimulationResult | null>(null),
  geneSimulation = ref<SimulationResult | null>(null);
const progressionInputError = computed(() => {
  const probability = bonus1.value + bonus4.value + bonus9.value;
  if (probability > 100)
    return "三项暴击概率合计不能超过 100%。请降低其中一项后重新计算。";
  if (from.value >= to.value) return "目标等级必须高于当前等级。";
  return "";
});
const researchLevels = computed(
  () =>
    (progression.value[researchKind.value === "version" ? "m" : "n"] ??
      []) as ProgressLevel[],
);
const emptyProgression: ProgressionCostResult = {
  deterministicClicks: 0,
  expectedClicks: 0,
  deterministicMaterials: {},
  expectedMaterials: {},
};
const researchResult = computed(() => {
  try {
    return calculateProgressionCosts(
      researchLevels.value
        .slice(Math.max(0, from.value), Math.max(from.value, to.value))
        .map((level) => ({
          progress: level.times,
          materialsPerClick: Object.fromEntries(
            level.consumables.map((item) => [item.name, item.num]),
          ),
        })),
      {
        bonus1Percent: bonus1.value,
        bonus4Percent: bonus4.value,
        bonus9Percent: bonus9.value,
      },
    );
  } catch {
    return emptyProgression;
  }
});
const starRows = computed(
  () =>
    (progression.value.s ?? []) as Array<{
      level: number;
      consumables: Material[];
    }>,
);
const starFrom = ref(0),
  starTo = ref(5);
const starResult = computed(() => {
  const materials: Record<string, number> = {};
  if (starFrom.value < 0 || starTo.value > 5 || starFrom.value >= starTo.value)
    return materials;
  for (const row of starRows.value.slice(starFrom.value, starTo.value))
    for (const item of row.consumables)
      materials[item.name] = (materials[item.name] ?? 0) + item.num;
  return materials;
});
const researchEquipment = [
  "帽子",
  "护盾",
  "护甲",
  "霰弹枪",
  "步枪",
  "喷火器",
  "双枪",
  "电磁",
  "狙击枪",
  "炮",
  "刀",
  "盾牌",
  "弓箭",
];
const researchEquipmentIndex = ref(0);
const attributeKeys = [
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
];
const researchAttributes = computed(
  () =>
    (progression.value[attributeKeys[researchEquipmentIndex.value]!] ??
      []) as AttributeLevel[],
);

const masteryEquipment = [
  "护甲",
  "霰弹枪",
  "步枪",
  "双枪",
  "刀",
  "盾牌",
  "炮",
  "狙击枪",
  "电磁",
  "雷托霰弹",
  "巨蛇霰弹",
  "蛛酶步枪",
  "蝶影双枪",
  "马刀",
  "猎鲨锋刃",
  "全钢盾牌",
  "菌焰喷火器",
  "深潜重炮",
  "保卫者狙击",
  "蝎尾狙击",
  "弧光电磁",
  "破潮弓",
];
const masteryEquipmentIndex = ref(0),
  masteryFrom = ref(0),
  masteryTo = ref(35);
const masteryVersionLevels = [80, 90, 100, 110, 120, 130, 140, 145];
const masteryVersionCaps = [5, 10, 15, 20, 25, 30, 35, 35];
const masteryVersionCostKeys = ["P", "Q", "R", "S", "T", "U", "V"];
const masteryVersionLevelIndex = ref(7);
const masteryLevelCap = computed(() =>
  masteryEquipmentIndex.value < 9
    ? masteryVersionCaps[masteryVersionLevelIndex.value]!
    : 35,
);
watch([masteryEquipmentIndex, masteryVersionLevelIndex], () => {
  if (masteryTo.value > masteryLevelCap.value)
    masteryTo.value = masteryLevelCap.value;
  if (masteryFrom.value >= masteryTo.value)
    masteryFrom.value = Math.max(0, masteryTo.value - 1);
});
const masteryAttributeKeys = ["o", "x", "A", "y", "r", "t", "u", "v", "w"];
const masteryAttributeKey = computed(() => {
  if (masteryEquipmentIndex.value < masteryAttributeKeys.length)
    return masteryAttributeKeys[masteryEquipmentIndex.value]!;
  const name = masteryEquipment[masteryEquipmentIndex.value] ?? "";
  if (name.includes("盾牌")) return "t";
  if (name.includes("刀") || name.includes("锋刃")) return "r";
  if (name.includes("炮")) return "u";
  if (name.includes("狙击")) return "v";
  if (name.includes("双枪")) return "y";
  if (name.includes("电磁") || name.includes("弓")) return "w";
  if (name.includes("霰弹")) return "x";
  return "A";
});
const masteryAttributes = computed(
  () =>
    (progression.value[masteryAttributeKey.value] ?? []) as AttributeLevel[],
);
function parseAttributes(row: AttributeLevel | undefined) {
  if (!row) return [] as string[];
  try {
    return JSON.parse(row.attr) as string[];
  } catch {
    return [];
  }
}
const masteryCurrentAttributes = computed(() =>
  parseAttributes(masteryAttributes.value[masteryFrom.value]),
);
const masteryTargetAttributes = computed(() =>
  parseAttributes(masteryAttributes.value[masteryTo.value]),
);
const evolutionOverrideKeys = [
  "C",
  "D",
  "E",
  "F",
  "G",
  "H",
  "I",
  "J",
  "K",
  "L",
  "M",
  "N",
  "O",
];
const masteryBase = computed(() => {
  if (masteryEquipmentIndex.value < 9) {
    const cap = masteryLevelCap.value;
    const key =
      masteryVersionCostKeys[
        Math.min(
          masteryVersionLevelIndex.value,
          masteryVersionCostKeys.length - 1,
        )
      ]!;
    const source = ((progression.value[key] ?? []) as ProgressLevel[]).map(
      (level) => ({
        ...level,
        consumables: level.consumables.map((item) => ({ ...item })),
      }),
    );
    if (masteryVersionLevelIndex.value === 7) {
      const replacements: Record<string, string> = {
        高硅钢: "航空板材",
        高分子纤维: "织物涂层",
        太阳能板: "全钢框架",
      };
      for (const level of source)
        for (const material of level.consumables)
          material.name = replacements[material.name] ?? material.name;
    }
    return source.slice(0, cap);
  }
  const base = ((progression.value.B ?? []) as ProgressLevel[]).map(
    (level) => ({
      ...level,
      consumables: level.consumables.map((item) => ({ ...item })),
    }),
  );
  const overrides = (progression.value[
    evolutionOverrideKeys[masteryEquipmentIndex.value - 9]!
  ] ?? []) as ProgressLevel[];
  for (const override of overrides) {
    const target = base[override.level - 1];
    if (target) {
      target.times = override.times;
      target.consumables = override.consumables;
    }
  }
  if (masteryEquipmentIndex.value === 15)
    for (const level of base)
      if (![3, 8, 13, 18, 23, 28, 33].includes(level.level)) level.times *= 0.6;
  return base;
});
const equipmentUnitPrice = ref(0),
  bookUnitPrice = ref(12500),
  materialUnitPrice = ref(0);
const masteryPrices = reactive<Record<string, number>>({
  小黄书: 12500,
  金条: 1,
});
const masteryResult = computed(() => {
  try {
    return calculateProgressionCosts(
      masteryBase.value
        .slice(
          Math.max(0, masteryFrom.value),
          Math.max(masteryFrom.value, masteryTo.value),
        )
        .map((level) => ({
          progress: level.times,
          criticalAllowed: ![3, 8, 13, 18, 23, 28, 33].includes(level.level),
          materialsPerClick: {
            ...Object.fromEntries(
              level.consumables.map((item) => [item.name, item.num]),
            ),
            金条: level.goldbar ?? 0,
          },
        })),
      { bonus1Percent: 0, bonus4Percent: 0, bonus9Percent: 0 },
    );
  } catch {
    return emptyProgression;
  }
});
const masteryInputError = computed(() => {
  if (masteryFrom.value >= masteryTo.value)
    return "目标专精等级必须高于当前专精等级。";
  return "";
});
const masteryMaterialNames = computed(() =>
  Object.keys(masteryResult.value.deterministicMaterials),
);
function masteryPrice(name: string) {
  if (Number.isFinite(masteryPrices[name])) return masteryPrices[name]!;
  if (name === "小黄书") return bookUnitPrice.value;
  if (name === "金条") return 1;
  return name.includes("枪") ||
    name.includes("刀") ||
    name.includes("盾") ||
    name.includes("甲") ||
    name.includes("弓") ||
    name.includes("炮")
    ? equipmentUnitPrice.value
    : materialUnitPrice.value;
}
const masteryGoldCost = computed(() =>
  Object.entries(masteryResult.value.deterministicMaterials).reduce(
    (sum, [name, amount]) => sum + amount * masteryPrice(name),
    0,
  ),
);

const accessoryCosts = [
  1, 2, 3, 5, 8, 13, 22, 39, 74, 121, 186, 349, 520, 719, 935, 1210, 1345, 1570,
  2280,
];
const accessoryFrom = ref(1),
  accessoryTo = ref(20);
const accessoryResult = computed(() => {
  try {
    return calculateUpgradeRange(
      accessoryCosts,
      accessoryFrom.value,
      accessoryTo.value,
    );
  } catch {
    return { levels: 0, total: 0 };
  }
});
const accessoryInputError = computed(() =>
  accessoryFrom.value >= accessoryTo.value
    ? "目标配件等级必须高于当前等级。"
    : "",
);

const beltCosts = [10, 15, 20, 30, 40, 55, 70, 90, 110, 130, 150];
const beltFrom = ref(1),
  beltTo = ref(12),
  beltType = ref<"attack" | "defense">("attack"),
  chipQuery = ref("");
const beltResult = computed(() => {
  try {
    return calculateUpgradeRange(beltCosts, beltFrom.value, beltTo.value);
  } catch {
    return { levels: 0, total: 0 };
  }
});
const beltInputError = computed(() =>
  beltFrom.value >= beltTo.value ? "目标芯片星级必须高于当前星级。" : "",
);
const beltChips = computed(() =>
  (
    (belt.value[beltType.value === "attack" ? "a" : "d"] ?? []) as BeltChip[]
  ).filter((chip) => chip.name.includes(chipQuery.value.trim())),
);
const selectedChip = ref<BeltChip | null>(null),
  chipLevel = ref(1);
const comparedChips = ref<BeltChip[]>([]);
watch(
  () => [beltType.value, props.content] as const,
  () => {
    selectedChip.value = beltChips.value[0] ?? null;
  },
  { immediate: true },
);
const chipLevelText = computed(
  () => selectedChip.value?.[`attr_${chipLevel.value}`] as string[] | undefined,
);
function resolveChipDescription(chip: BeltChip, level: number) {
  let description = chip.attr ?? "";
  const values = (chip[`attr_${level}`] as string[] | undefined) ?? [];
  for (const [index, value] of values.entries())
    description = description.replace(`#${index + 1}#`, value);
  return cleanHtml(description);
}
const chipDescription = computed(() =>
  selectedChip.value
    ? resolveChipDescription(selectedChip.value, chipLevel.value)
    : "",
);
function addComparedChip() {
  const chip = selectedChip.value;
  if (!chip || comparedChips.value.some((item) => item.name === chip.name))
    return;
  comparedChips.value = [...comparedChips.value.slice(-1), chip];
}

const graphTypes = ["头盔", "轻型", "重型", "冷兵器", "护甲", "护盾", "无人机"];
const graphKeys = ["ye_0", "he_0", "ze_0", "be_0", "ke_0", "je_0", "we_0"];
const graphEquipmentKeys = [
  "Qe_0",
  "Ke_0",
  "We_0",
  "Ye_0",
  "Xe_0",
  "Ze_0",
  "ea_0",
];
const graphType = ref(0),
  graphFrom = ref(1),
  graphTo = ref(9);
const graphLevels = computed(
  () => (graph.value[graphKeys[graphType.value]!] ?? []) as GraphLevel[],
);
const graphCurrent = computed(
  () => graphLevels.value[Math.max(0, graphFrom.value - 1)],
);
const graphTarget = computed(
  () => graphLevels.value[Math.max(0, graphTo.value - 1)],
);
const graphInputError = computed(() =>
  graphFrom.value > graphTo.value ? "目标图谱等级不能低于当前等级。" : "",
);
const graphEquipmentQuery = ref("");
const graphTargetLevels = reactive<number[]>([1, 1, 1, 1, 1, 1, 1]);
const graphEquipment = computed(() =>
  (
    (graph.value[graphEquipmentKeys[graphType.value]!] ?? []) as Array<{
      name: string;
      level?: number;
      init_value: number;
      max_star?: number;
      max_zy?: number;
      max_zj?: number;
      skin?: Array<{ name: string; value?: number }>;
    }>
  ).filter((item) => {
    const query = graphEquipmentQuery.value.trim();
    return (
      item.name.includes(query) ||
      (item.skin ?? []).some((skin) => skin.name.includes(query))
    );
  }),
);
type GraphEquipment = (typeof graphEquipment.value)[number];
type GraphRecipeState = {
  star: number;
  research: number;
  mastery: number;
  skins: string[];
};
const selectedGraphEquipment = ref<GraphEquipment | null>(null);
const graphRecipeStar = ref(0),
  graphRecipeResearch = ref(0),
  graphRecipeMastery = ref(0),
  graphSelectedSkins = ref<string[]>([]);
const graphStarTables = computed(() => (graph.value.Ce_0 ?? []) as number[][]);
const graphResearchTables = computed(
  () => (graph.value.Ue_0 ?? []) as number[][],
);
const graphMasteryTables = computed(
  () => (graph.value.Ee_0 ?? []) as number[][],
);
const graphPortfolioMode = ref<"current" | "target">("current");
const graphCurrentPortfolio = reactive<Record<string, GraphRecipeState>>({});
const graphTargetPortfolio = reactive<Record<string, GraphRecipeState>>({});
const effectiveGraphTargetPortfolio = computed<
  Record<string, GraphRecipeState>
>(() => {
  const result: Record<string, GraphRecipeState> = {};
  const names = new Set([
    ...Object.keys(graphCurrentPortfolio),
    ...Object.keys(graphTargetPortfolio),
  ]);
  for (const name of names) {
    const current = graphCurrentPortfolio[name];
    const target = graphTargetPortfolio[name];
    if (!current && target) {
      result[name] = { ...target, skins: [...target.skins] };
      continue;
    }
    if (!current) continue;
    result[name] = target
      ? {
          star: Math.max(current.star, target.star),
          research: Math.max(current.research, target.research),
          mastery: Math.max(current.mastery, target.mastery),
          skins: [...new Set([...current.skins, ...target.skins])],
        }
      : { ...current, skins: [...current.skins] };
  }
  return result;
});
const activeGraphPortfolio = computed(() => graphCurrentPortfolio);
function tableValue(table: number[] | undefined, level: number) {
  return table?.[Math.max(0, Math.min(level, (table?.length ?? 1) - 1))] ?? 0;
}
function calculateGraphContribution(
  item: GraphEquipment,
  state: GraphRecipeState,
) {
  const init = item.init_value;
  let starIndex = (
    { 40: 0, 45: 1, 50: 2, 55: 3, 60: 4, 65: 5 } as Record<number, number>
  )[init];
  let researchIndex = (
    { 40: 0, 45: 1, 50: 2, 55: 3, 60: 4, 65: 5 } as Record<number, number>
  )[init];
  let masteryIndex = ({ 45: 0, 55: 1, 60: 2, 65: 3 } as Record<number, number>)[
    init
  ];
  if (item.name === "火焰喷射器") {
    starIndex = 6;
    researchIndex = 6;
    masteryIndex = 4;
  }
  const base =
    item.max_star && item.max_star >= 3 && starIndex !== undefined
      ? tableValue(graphStarTables.value[starIndex], state.star)
      : init;
  const levelValue =
    item.max_zj &&
    item.max_zj > 0 &&
    state.mastery > 0 &&
    masteryIndex !== undefined
      ? tableValue(graphMasteryTables.value[masteryIndex], state.mastery)
      : researchIndex !== undefined
        ? tableValue(graphResearchTables.value[researchIndex], state.research)
        : 0;
  const skinValue = (item.skin ?? [])
    .filter((skin) => state.skins.includes(skin.name))
    .reduce((sum, skin) => sum + (skin.value ?? 0), 0);
  return base + levelValue + skinValue;
}
const graphRecipeContribution = computed(() => {
  const item = selectedGraphEquipment.value;
  if (!item) return 0;
  return calculateGraphContribution(item, {
    star: graphRecipeStar.value,
    research: graphRecipeResearch.value,
    mastery: graphRecipeMastery.value,
    skins: graphSelectedSkins.value,
  });
});
function graphMaxContribution(item: GraphEquipment) {
  return calculateGraphContribution(item, {
    star: item.max_star ?? 0,
    research: item.max_zy ?? 0,
    mastery: item.max_zj ?? 0,
    skins: (item.skin ?? []).map((skin) => skin.name),
  });
}
function graphSavedContribution(item: GraphEquipment) {
  const state = graphCurrentPortfolio[item.name];
  return state ? calculateGraphContribution(item, state) : 0;
}
function graphResearchCapForStar(item: GraphEquipment, star: number) {
  const capByStar = [10, 15, 20, 25, 30, 30];
  return Math.min(item.max_zy ?? 0, capByStar[Math.max(0, Math.min(5, star))]!);
}
function graphMasteryCapForStar(item: GraphEquipment, star: number) {
  if (star < 4) return 0;
  if (star === 4) return Math.min(item.max_zj ?? 0, 20);
  return item.max_zj ?? 0;
}
const graphSelectedResearchCap = computed(() =>
  selectedGraphEquipment.value
    ? graphResearchCapForStar(
        selectedGraphEquipment.value,
        graphRecipeStar.value,
      )
    : 0,
);
const graphSelectedMasteryCap = computed(() =>
  selectedGraphEquipment.value
    ? graphMasteryCapForStar(
        selectedGraphEquipment.value,
        graphRecipeStar.value,
      )
    : 0,
);
const graphPortfolioItems = computed(() => {
  const all = (graph.value[graphEquipmentKeys[graphType.value]!] ??
    []) as GraphEquipment[];
  return all
    .filter((item) => activeGraphPortfolio.value[item.name])
    .map((item) => ({
      item,
      state: activeGraphPortfolio.value[item.name]!,
      contribution: calculateGraphContribution(
        item,
        activeGraphPortfolio.value[item.name]!,
      ),
    }));
});
const graphPortfolioContribution = computed(() =>
  graphPortfolioItems.value.reduce((sum, entry) => sum + entry.contribution, 0),
);
function graphEntries(
  portfolio: Record<string, GraphRecipeState>,
  fallback?: Record<string, GraphRecipeState>,
) {
  const all = (graph.value[graphEquipmentKeys[graphType.value]!] ??
    []) as GraphEquipment[];
  return all
    .filter((item) => portfolio[item.name] ?? fallback?.[item.name])
    .map((item) => ({
      item,
      state: (portfolio[item.name] ?? fallback?.[item.name])!,
      contribution: calculateGraphContribution(
        item,
        (portfolio[item.name] ?? fallback?.[item.name])!,
      ),
    }));
}
const graphCurrentItems = computed(() => graphEntries(graphCurrentPortfolio));
const graphTargetItems = computed(() =>
  graphEntries(effectiveGraphTargetPortfolio.value),
);
const graphCurrentContribution = computed(() =>
  graphCurrentItems.value.reduce((sum, entry) => sum + entry.contribution, 0),
);
const graphTargetContribution = computed(() =>
  graphTargetItems.value.reduce((sum, entry) => sum + entry.contribution, 0),
);
function graphLevelFromScore(score: number) {
  let level = 1;
  for (const row of graphLevels.value) if (score >= row.exp) level = row.id;
  return level;
}
const graphCurrentPortfolioLevel = computed(() =>
  graphLevelFromScore(graphCurrentContribution.value),
);
const graphSelectedTargetLevel = computed({
  get: () =>
    Math.max(
      graphCurrentPortfolioLevel.value,
      graphTargetLevels[graphType.value] ?? 1,
    ),
  set: (value: number) => {
    graphTargetLevels[graphType.value] = Math.max(
      graphCurrentPortfolioLevel.value,
      Math.min(graphLevels.value.length, Number(value) || 1),
    );
  },
});
const graphSelectedTargetScore = computed(
  () =>
    graphLevels.value[graphSelectedTargetLevel.value - 1]?.exp ??
    graphCurrentContribution.value,
);
const graphSelectedNeededScore = computed(() =>
  Math.max(0, graphSelectedTargetScore.value - graphCurrentContribution.value),
);
const graphTargetPortfolioLevel = computed(() =>
  graphLevelFromScore(graphTargetContribution.value),
);
const graphAllTypeSummary = computed(() =>
  graphTypes.map((name, index) => {
    const items = (graph.value[graphEquipmentKeys[index]!] ??
      []) as GraphEquipment[];
    const levels = (graph.value[graphKeys[index]!] ?? []) as GraphLevel[];
    const score = (
      portfolio: Record<string, GraphRecipeState>,
      fallback?: Record<string, GraphRecipeState>,
    ) =>
      items.reduce((sum, item) => {
        const state = portfolio[item.name] ?? fallback?.[item.name];
        return state ? sum + calculateGraphContribution(item, state) : sum;
      }, 0);
    const level = (value: number) =>
      levels.reduce((result, row) => (value >= row.exp ? row.id : result), 1);
    const current = score(graphCurrentPortfolio);
    const currentLevel = level(current);
    const targetLevel = Math.max(
      currentLevel,
      Math.min(levels.length, graphTargetLevels[index] ?? 1),
    );
    const target = levels[targetLevel - 1]?.exp ?? current;
    return {
      name,
      current,
      target,
      currentLevel,
      targetLevel,
    };
  }),
);
function clearActiveGraphCategory() {
  const names = new Set(
    (
      (graph.value[graphEquipmentKeys[graphType.value]!] ??
        []) as GraphEquipment[]
    ).map((item) => item.name),
  );
  for (const name of Object.keys(activeGraphPortfolio.value))
    if (names.has(name)) delete activeGraphPortfolio.value[name];
  selectedGraphEquipment.value = null;
}
function fillActiveGraphCategory(includeLocked: boolean) {
  const items = (graph.value[graphEquipmentKeys[graphType.value]!] ??
    []) as GraphEquipment[];
  for (const item of items) {
    if (!includeLocked && !activeGraphPortfolio.value[item.name]) continue;
    activeGraphPortfolio.value[item.name] = {
      star: item.max_star ?? 0,
      research: item.max_zy ?? 0,
      mastery: item.max_zj ?? 0,
      skins: includeLocked
        ? (item.skin ?? []).map((skin) => skin.name)
        : [...(activeGraphPortfolio.value[item.name]?.skins ?? [])],
    };
  }
  selectedGraphEquipment.value = null;
}
function saveGraphRecipe() {
  const item = selectedGraphEquipment.value;
  if (!item) return;
  activeGraphPortfolio.value[item.name] = {
    star: graphRecipeStar.value,
    research: graphRecipeResearch.value,
    mastery: graphRecipeMastery.value,
    skins: [...graphSelectedSkins.value],
  };
}
function updateGraphRecipeStar() {
  const item = selectedGraphEquipment.value;
  if (!item) return;
  graphRecipeResearch.value = Math.min(
    graphRecipeResearch.value,
    graphResearchCapForStar(item, graphRecipeStar.value),
  );
  graphRecipeMastery.value = Math.min(
    graphRecipeMastery.value,
    graphMasteryCapForStar(item, graphRecipeStar.value),
  );
  if (graphRecipeResearch.value < (item.max_zy ?? 0))
    graphRecipeMastery.value = 0;
  saveGraphRecipe();
}
function updateGraphRecipeResearch() {
  const item = selectedGraphEquipment.value;
  if (!item) return;
  const research = graphRecipeResearch.value;
  const requiredStar =
    research > 25
      ? 4
      : research > 20
        ? 3
        : research > 15
          ? 2
          : research > 10
            ? 1
            : 0;
  graphRecipeStar.value = Math.max(graphRecipeStar.value, requiredStar);
  if (research < (item.max_zy ?? 0)) graphRecipeMastery.value = 0;
  saveGraphRecipe();
}
function updateGraphRecipeMastery() {
  const item = selectedGraphEquipment.value;
  if (!item) return;
  const mastery = graphRecipeMastery.value;
  if (mastery > 0) {
    graphRecipeStar.value = Math.max(
      graphRecipeStar.value,
      mastery > 20 ? 5 : 4,
    );
    graphRecipeResearch.value = item.max_zy ?? 0;
  }
  saveGraphRecipe();
}
function removeSelectedGraphRecipe() {
  const item = selectedGraphEquipment.value;
  if (!item) return;
  delete activeGraphPortfolio.value[item.name];
  if (
    graphPortfolioMode.value === "current" &&
    graphTargetPortfolio[item.name] &&
    graphTargetPortfolio[item.name]!.star <= graphRecipeStar.value &&
    graphTargetPortfolio[item.name]!.research <= graphRecipeResearch.value &&
    graphTargetPortfolio[item.name]!.mastery <= graphRecipeMastery.value &&
    graphTargetPortfolio[item.name]!.skins.every((skin) =>
      graphSelectedSkins.value.includes(skin),
    )
  )
    delete graphTargetPortfolio[item.name];
  graphRecipeStar.value = 0;
  graphRecipeResearch.value = 0;
  graphRecipeMastery.value = 0;
  graphSelectedSkins.value = [];
  selectedGraphEquipment.value = null;
}
function maxSelectedGraphRecipe() {
  const item = selectedGraphEquipment.value;
  if (!item) return;
  graphRecipeStar.value = item.max_star ?? 0;
  graphRecipeResearch.value = item.max_zy ?? 0;
  graphRecipeMastery.value = item.max_zj ?? 0;
  graphSelectedSkins.value = (item.skin ?? []).map((skin) => skin.name);
  saveGraphRecipe();
}
function selectGraphEquipment(item: GraphEquipment) {
  if (selectedGraphEquipment.value?.name === item.name) {
    removeSelectedGraphRecipe();
    return;
  }
  selectedGraphEquipment.value = item;
  const saved =
    graphPortfolioMode.value === "target"
      ? effectiveGraphTargetPortfolio.value[item.name]
      : activeGraphPortfolio.value[item.name];
  graphRecipeStar.value = saved?.star ?? 0;
  graphRecipeResearch.value = saved?.research ?? 0;
  graphRecipeMastery.value = saved?.mastery ?? 0;
  graphSelectedSkins.value = [...(saved?.skins ?? [])];
  if (!activeGraphPortfolio.value[item.name]) {
    saveGraphRecipe();
  }
}
function copyCurrentGraphToTarget() {
  for (const key of Object.keys(graphTargetPortfolio))
    delete graphTargetPortfolio[key];
  for (const [name, state] of Object.entries(graphCurrentPortfolio))
    graphTargetPortfolio[name] = { ...state, skins: [...state.skins] };
  graphPortfolioMode.value = "target";
  selectedGraphEquipment.value = null;
}
const graphGachaNames = new Set([
  "特级护目镜",
  "银犀战盔",
  "开拓者突击枪",
  "95式突击步枪",
  "左轮手枪",
  "火焰喷射器",
  "弧光电磁机枪",
  "雷托霰弹枪",
  "蝶影双枪",
  "蝶影左轮手枪",
  "仿生蛛酶步枪",
  "仿生蛛螯步枪",
  "菌焰喷火器",
  "仿生巨蛇霰弹",
  "仿生瞬豹霰弹枪",
  "竞技用反曲弓",
  "碳素蜘蛛弓",
  "破潮弓",
  "强袭榴弹炮",
  "保卫者狙击枪",
  "仿生深潜重炮",
  "仿生深潜火箭筒",
  "仿生蝎尾狙击",
  "仿生游隼狙击",
  "全钢盾牌",
  "斩马刀",
  "仿生猎鲨锋刃",
  "仿生猎兽锋刃",
  "深红战甲",
  "进阶基础护盾",
  "进阶蔚蓝护盾",
  "进阶磺骨护盾",
  "守望者护盾",
]);
const graphMasteryOverrides: Record<string, { key: string; cap: number }> = {
  深红战甲: { key: "W", cap: 20 },
  火焰喷射器: { key: "Y", cap: 20 },
  "95式突击步枪": { key: "X", cap: 20 },
  左轮手枪: { key: "Z", cap: 35 },
  竞技用反曲弓: { key: "_", cap: 20 },
  碳素蜘蛛弓: { key: "$", cap: 20 },
  强袭榴弹炮: { key: "a0", cap: 20 },
  雷托霰弹枪: { key: "C", cap: 35 },
  仿生巨蛇霰弹: { key: "D", cap: 35 },
  仿生蛛酶步枪: { key: "E", cap: 35 },
  蝶影双枪: { key: "F", cap: 35 },
  斩马刀: { key: "G", cap: 35 },
  仿生猎鲨锋刃: { key: "H", cap: 35 },
  全钢盾牌: { key: "I", cap: 35 },
  菌焰喷火器: { key: "J", cap: 35 },
  仿生深潜重炮: { key: "K", cap: 35 },
  保卫者狙击枪: { key: "L", cap: 35 },
  仿生蝎尾狙击: { key: "M", cap: 35 },
  弧光电磁机枪: { key: "N", cap: 35 },
  破潮弓: { key: "O", cap: 35 },
};
function graphMasteryLevels(item: GraphEquipment) {
  const special = graphMasteryOverrides[item.name];
  if (special) {
    const base = ((progression.value.B ?? []) as ProgressLevel[]).map(
      (level) => ({
        ...level,
        consumables: level.consumables.map((material) => ({ ...material })),
      }),
    );
    for (const override of (progression.value[special.key] ??
      []) as ProgressLevel[]) {
      const row = base[override.level - 1];
      if (row) {
        row.times = override.times;
        row.consumables = override.consumables.map((material) => ({
          ...material,
        }));
      }
    }
    if (item.name === "全钢盾牌")
      for (const row of base)
        if (![3, 8, 13, 18, 23, 28, 33].includes(row.level)) row.times *= 0.6;
    return base.slice(0, special.cap);
  }
  const levelIndex = masteryVersionLevels.indexOf(item.level ?? 145);
  const safeIndex = levelIndex >= 0 ? levelIndex : 7;
  const key =
    masteryVersionCostKeys[
      Math.min(safeIndex, masteryVersionCostKeys.length - 1)
    ]!;
  const levels = ((progression.value[key] ?? []) as ProgressLevel[]).map(
    (row) => ({
      ...row,
      consumables: row.consumables.map((material) => ({ ...material })),
    }),
  );
  if (safeIndex === 7) {
    const replacements: Record<string, string> = {
      高硅钢: "航空板材",
      高分子纤维: "织物涂层",
      太阳能板: "全钢框架",
    };
    for (const row of levels)
      for (const material of row.consumables)
        material.name = replacements[material.name] ?? material.name;
  }
  return levels.slice(0, masteryVersionCaps[safeIndex]!);
}
type GraphUpgradeCost = {
  deterministicClicks: number;
  expectedClicks: number;
  materials: Record<string, number>;
  errors: string[];
};
const graphUpgradeCost = computed<GraphUpgradeCost>(() => {
  const result: GraphUpgradeCost = {
    deterministicClicks: 0,
    expectedClicks: 0,
    materials: {},
    errors: [],
  };
  const addMaterial = (name: string, amount: number) => {
    result.materials[name] = (result.materials[name] ?? 0) + amount;
  };
  for (const equipmentKey of graphEquipmentKeys) {
    const all = (graph.value[equipmentKey] ?? []) as GraphEquipment[];
    for (const item of all) {
      const current = graphCurrentPortfolio[item.name] ?? {
        star: 0,
        research: 0,
        mastery: 0,
        skins: [],
      };
      const target = effectiveGraphTargetPortfolio.value[item.name];
      if (!target) continue;
      if (
        target.star < current.star ||
        target.research < current.research ||
        target.mastery < current.mastery ||
        current.skins.some((skin) => !target.skins.includes(skin))
      ) {
        result.errors.push(`${item.name}存在降级设置`);
        continue;
      }
      for (const row of starRows.value.slice(current.star, target.star))
        for (const material of row.consumables)
          addMaterial(material.name, material.num);
      const researchRows = (progression.value[
        graphGachaNames.has(item.name) ? "n" : "m"
      ] ?? []) as ProgressLevel[];
      const researchCost = calculateProgressionCosts(
        researchRows.slice(current.research, target.research).map((row) => ({
          progress: row.times,
          materialsPerClick: Object.fromEntries(
            row.consumables.map((material) => [material.name, material.num]),
          ),
        })),
        {
          bonus1Percent: bonus1.value,
          bonus4Percent: bonus4.value,
          bonus9Percent: bonus9.value,
        },
      );
      result.deterministicClicks += researchCost.deterministicClicks;
      result.expectedClicks += researchCost.expectedClicks;
      for (const [name, amount] of Object.entries(
        researchCost.expectedMaterials,
      ))
        addMaterial(name, amount);
      const researchDungeonMaterial = graphGachaNames.has(item.name)
        ? "合金螺母"
        : (item.level ?? 145) >= 140
          ? "光纤模块"
          : (item.level ?? 145) >= 130
            ? "集成电路"
            : (item.level ?? 145) >= 120
              ? "合金轴承"
              : (item.level ?? 145) >= 110
                ? "固态电容"
                : "特种电阻";
      if (researchCost.expectedClicks > 0)
        addMaterial(researchDungeonMaterial, researchCost.expectedClicks);
      const masteryRows = graphMasteryLevels(item);
      const masteryCost = calculateProgressionCosts(
        masteryRows.slice(current.mastery, target.mastery).map((row) => ({
          progress: row.times,
          criticalAllowed: ![3, 8, 13, 18, 23, 28, 33].includes(row.level),
          materialsPerClick: {
            ...Object.fromEntries(
              row.consumables.map((material) => [material.name, material.num]),
            ),
            金条: row.goldbar ?? 0,
          },
        })),
        {
          bonus1Percent: bonus1.value,
          bonus4Percent: bonus4.value,
          bonus9Percent: bonus9.value,
        },
      );
      result.deterministicClicks += masteryCost.deterministicClicks;
      result.expectedClicks += masteryCost.expectedClicks;
      for (const [name, amount] of Object.entries(
        masteryCost.expectedMaterials,
      ))
        addMaterial(name, amount);
    }
  }
  return result;
});
const graphPrices = reactive<Record<string, number>>({
  小黄书: 12500,
  金条: 1,
});
function graphMaterialPrice(name: string) {
  if (Number.isFinite(graphPrices[name])) return graphPrices[name]!;
  const bundled = (
    (graph.value.e_0 ?? []) as Array<{ name: string; price: number }>
  ).find((item) => item.name === name)?.price;
  return bundled ?? masteryPrice(name);
}
const graphUpgradeGoldValue = computed(() =>
  Object.entries(graphUpgradeCost.value.materials).reduce(
    (sum, [name, amount]) => sum + amount * graphMaterialPrice(name),
    0,
  ),
);
watch(graphType, () => {
  selectedGraphEquipment.value = null;
  graphEquipmentQuery.value = "";
});

const humanKeys = ["E_0", "N_0", "T_0", "U_0", "z_0", "B_0", "V_0"],
  halfKeys = ["Zt_0", "el_0", "al_0", "tl_0", "ll_0", "nl_0", "sl_0"];
const geneMode = computed(() =>
  active.value === "human" ? humanKeys : halfKeys,
);
const geneTiers = computed(() =>
  geneMode.value.map((key) => gene.value[key] as GeneTier).filter(Boolean),
);
const geneProgress = ref(100),
  humanGene2 = ref(17),
  humanGene4 = ref(11),
  halfGene2 = ref(20),
  halfGene4 = ref(14);
const activeGene2 = computed({
  get: () => (active.value === "half" ? halfGene2.value : humanGene2.value),
  set: (value: number) => {
    if (active.value === "half") halfGene2.value = value;
    else humanGene2.value = value;
  },
});
const activeGene4 = computed({
  get: () => (active.value === "half" ? halfGene4.value : humanGene4.value),
  set: (value: number) => {
    if (active.value === "half") halfGene4.value = value;
    else humanGene4.value = value;
  },
});
const gene2 = activeGene2,
  gene4 = activeGene4;
const geneExpected = computed(() => {
  try {
    return calculateExpectedGeneClicks(
      geneProgress.value,
      activeGene2.value,
      activeGene4.value,
    );
  } catch {
    return 0;
  }
});
const geneInputError = computed(() =>
  activeGene2.value + activeGene4.value > 100
    ? "2倍与4倍概率合计不能超过 100%。"
    : "",
);
const geneCapsules = ref(9999),
  geneSerum = ref(999999);
const geneTierIndex = ref(1),
  geneNodeIndex = ref(0),
  geneStageFrom = ref(0),
  geneStageTo = ref(1),
  geneStageProgress = ref(0),
  geneStageActivated = ref(false);
const selectedGeneTier = computed(() => geneTiers.value[geneTierIndex.value]);
const selectedGeneNode = computed(
  () => selectedGeneTier.value?.attr_section[geneNodeIndex.value],
);
watch(active, (module) => {
  if (module === "human" || module === "half") {
    geneTierIndex.value = 1;
    geneNodeIndex.value = 0;
    geneStageFrom.value = 0;
    geneStageTo.value = 1;
    geneStageProgress.value = 0;
    geneStageActivated.value = false;
  }
});
watch(geneTierIndex, () => {
  geneNodeIndex.value = 0;
  geneStageFrom.value = 0;
  geneStageTo.value = Math.min(
    1,
    selectedGeneTier.value?.attr_section_consumables.length ?? 1,
  );
  geneStageProgress.value = 0;
  geneStageActivated.value = false;
});
watch(geneStageFrom, (stage) => {
  if (geneStageTo.value <= stage) geneStageTo.value = stage + 1;
  geneStageProgress.value = 0;
  geneStageActivated.value = false;
});
const geneNodePlan = computed(() => {
  const tier = selectedGeneTier.value,
    node = selectedGeneNode.value;
  const materials: Record<string, number> = {};
  let expectedClicks = 0,
    deterministicClicks = 0;
  if (!tier || !node || geneStageFrom.value >= geneStageTo.value)
    return { materials, expectedClicks, deterministicClicks };
  const end = Math.min(geneStageTo.value, tier.attr_section_consumables.length);
  for (
    let stageIndex = geneStageFrom.value;
    stageIndex < end;
    stageIndex += 1
  ) {
    const stage = tier.attr_section_consumables[stageIndex]!;
    const isCurrent = stageIndex === geneStageFrom.value;
    const activated = isCurrent && geneStageActivated.value;
    const currentProgress = isCurrent
      ? Math.max(0, geneStageProgress.value)
      : 0;
    let progressAfterActivation = currentProgress;
    if (!activated) {
      materials[stage.active.cond.name] =
        (materials[stage.active.cond.name] ?? 0) + stage.active.cond.num;
      progressAfterActivation += stage.active.score;
      deterministicClicks += 1;
      expectedClicks += 1;
    }
    const remainingUnits = Math.ceil(
      Math.max(0, node.single_bar_score - progressAfterActivation) /
        stage.single.score,
    );
    const clicks = calculateExpectedGeneClicks(
      remainingUnits,
      activeGene2.value,
      activeGene4.value,
    );
    deterministicClicks += remainingUnits;
    expectedClicks += clicks;
    materials[stage.single.cond.name] =
      (materials[stage.single.cond.name] ?? 0) + clicks * stage.single.cond.num;
  }
  return { materials, expectedClicks, deterministicClicks };
});
const geneTierTotals = computed(() =>
  geneTiers.value.map((tier) => {
    const materials: Record<string, number> = {};
    let deterministicClicks = 0;
    let expectedClicks = 0;
    for (const node of tier.attr_section) {
      for (const stage of tier.attr_section_consumables) {
        materials[stage.active.cond.name] =
          (materials[stage.active.cond.name] ?? 0) + stage.active.cond.num;
        const remaining = Math.max(
          0,
          node.single_bar_score - stage.active.score,
        );
        const clicks = calculateExpectedGeneClicks(
          Math.ceil(remaining / stage.single.score),
          activeGene2.value,
          activeGene4.value,
        );
        deterministicClicks += 1 + Math.ceil(remaining / stage.single.score);
        expectedClicks += 1 + clicks;
        materials[stage.single.cond.name] =
          (materials[stage.single.cond.name] ?? 0) +
          clicks * stage.single.cond.num;
      }
    }
    for (const key of tier.key_section?.attr ?? [])
      if (key.consumables)
        materials[key.consumables.name] =
          (materials[key.consumables.name] ?? 0) + key.consumables.num;
    return { tier, materials, deterministicClicks, expectedClicks };
  }),
);
const geneFullTotals = computed(() =>
  geneTierTotals.value.reduce(
    (result, row) => {
      result.deterministicClicks += row.deterministicClicks;
      result.expectedClicks += row.expectedClicks;
      for (const [name, amount] of Object.entries(row.materials))
        result.materials[name] = (result.materials[name] ?? 0) + amount;
      return result;
    },
    {
      materials: {} as Record<string, number>,
      deterministicClicks: 0,
      expectedClicks: 0,
    },
  ),
);
const geneInventoryEnough = computed(() => ({
  胶囊: geneCapsules.value >= (geneFullTotals.value.materials.胶囊 ?? 0),
  血清: geneSerum.value >= (geneFullTotals.value.materials.血清 ?? 0),
}));

const reformRows = computed(
  () => (staticData.value.Xl_0 ?? []) as ReformationRow[],
);
const reformFrom = ref(0),
  reformTo = ref(1),
  balanced = ref(false);
const reformResult = computed(() => {
  const rows = reformRows.value.slice(reformFrom.value, reformTo.value);
  const result = calculateReformationCosts(
    rows.map((row) => ({
      clicks: row.times,
      moleculePerClick: row.molecule,
      nano3PerClick: row.nano,
      goldPerClick: row.goldbar,
      promotionMolecule: row.molecule,
      promotionNano3: row.nano,
      promotionGold: row.goldbar,
    })),
  );
  const factor = balanced.value ? 3 : 1;
  return {
    clicks: result.clicks * factor,
    molecule: result.molecule * factor,
    nano3: result.nano3 * factor,
    gold: result.gold * factor,
  };
});
const reformInputError = computed(() =>
  reformFrom.value >= reformTo.value ? "目标改造阶段必须高于当前阶段。" : "",
);
function format(value: number) {
  return new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 2 }).format(
    value,
  );
}
function cleanHtml(value: string) {
  return value.replace(/<[^>]*>/g, " ").replace(/#\d#/g, "数值");
}
function runResearchSimulation() {
  try {
    researchSimulation.value = simulateProgress(
      researchLevels.value
        .slice(from.value, to.value)
        .reduce((sum, level) => sum + level.times, 0),
      [
        {
          progress: 1,
          percent: 100 - bonus1.value - bonus4.value - bonus9.value,
          label: "无暴击",
        },
        { progress: 2, percent: bonus1.value, label: "+1" },
        { progress: 5, percent: bonus4.value, label: "+4" },
        { progress: 10, percent: bonus9.value, label: "+9" },
      ],
      simulationSeed.value,
    );
  } catch {
    researchSimulation.value = null;
  }
}
function runGeneSimulation() {
  try {
    geneSimulation.value = simulateProgress(
      geneProgress.value,
      [
        {
          progress: 1,
          percent: 100 - activeGene2.value - activeGene4.value,
          label: "1倍",
        },
        { progress: 2, percent: activeGene2.value, label: "2倍" },
        { progress: 4, percent: activeGene4.value, label: "4倍" },
      ],
      simulationSeed.value,
    );
  } catch {
    geneSimulation.value = null;
  }
}
const planName = ref("");
const modulePlans = computed(() =>
  props.plans.filter((plan) => plan.planType === `growth:${active.value}`),
);
function snapshot(): Record<string, unknown> {
  return {
    from: from.value,
    to: to.value,
    researchKind: researchKind.value,
    researchEquipmentIndex: researchEquipmentIndex.value,
    starFrom: starFrom.value,
    starTo: starTo.value,
    bonus1: bonus1.value,
    bonus4: bonus4.value,
    bonus9: bonus9.value,
    simulationSeed: simulationSeed.value,
    masteryEquipmentIndex: masteryEquipmentIndex.value,
    masteryVersionLevelIndex: masteryVersionLevelIndex.value,
    masteryFrom: masteryFrom.value,
    masteryTo: masteryTo.value,
    equipmentUnitPrice: equipmentUnitPrice.value,
    bookUnitPrice: bookUnitPrice.value,
    materialUnitPrice: materialUnitPrice.value,
    masteryPrices: { ...masteryPrices },
    accessoryFrom: accessoryFrom.value,
    accessoryTo: accessoryTo.value,
    beltFrom: beltFrom.value,
    beltTo: beltTo.value,
    beltType: beltType.value,
    selectedChipName: selectedChip.value?.name,
    comparedChipNames: comparedChips.value.map((chip) => chip.name),
    chipLevel: chipLevel.value,
    graphType: graphType.value,
    graphFrom: graphFrom.value,
    graphTo: graphTo.value,
    selectedGraphEquipmentName: selectedGraphEquipment.value?.name,
    graphRecipeStar: graphRecipeStar.value,
    graphRecipeResearch: graphRecipeResearch.value,
    graphRecipeMastery: graphRecipeMastery.value,
    graphSelectedSkins: [...graphSelectedSkins.value],
    graphPortfolioMode: graphPortfolioMode.value,
    graphTargetLevels: [...graphTargetLevels],
    graphCurrentPortfolio: Object.fromEntries(
      Object.entries(graphCurrentPortfolio).map(([name, state]) => [
        name,
        { ...state, skins: [...state.skins] },
      ]),
    ),
    graphTargetPortfolio: Object.fromEntries(
      Object.entries(graphTargetPortfolio).map(([name, state]) => [
        name,
        { ...state, skins: [...state.skins] },
      ]),
    ),
    graphPrices: { ...graphPrices },
    geneProgress: geneProgress.value,
    gene2: humanGene2.value,
    gene4: humanGene4.value,
    halfGene2: halfGene2.value,
    halfGene4: halfGene4.value,
    geneCapsules: geneCapsules.value,
    geneSerum: geneSerum.value,
    geneTierIndex: geneTierIndex.value,
    geneNodeIndex: geneNodeIndex.value,
    geneStageFrom: geneStageFrom.value,
    geneStageTo: geneStageTo.value,
    geneStageProgress: geneStageProgress.value,
    geneStageActivated: geneStageActivated.value,
    reformFrom: reformFrom.value,
    reformTo: reformTo.value,
    balanced: balanced.value,
  };
}
function savePlan() {
  const name = planName.value.trim();
  if (!name) return;
  emit("savePlan", { name, module: active.value, payload: snapshot() });
  planName.value = "";
}
function applyPlan(plan: GrowthPlan) {
  const p = plan.payload;
  const numberRefs: Record<string, { value: number }> = {
    from,
    to,
    researchEquipmentIndex,
    starFrom,
    starTo,
    bonus1,
    bonus4,
    bonus9,
    masteryEquipmentIndex,
    masteryVersionLevelIndex,
    masteryFrom,
    masteryTo,
    equipmentUnitPrice,
    bookUnitPrice,
    materialUnitPrice,
    accessoryFrom,
    accessoryTo,
    beltFrom,
    beltTo,
    chipLevel,
    graphType,
    graphFrom,
    graphTo,
    graphRecipeStar,
    graphRecipeResearch,
    graphRecipeMastery,
    geneProgress,
    gene2: humanGene2,
    gene4: humanGene4,
    halfGene2,
    halfGene4,
    geneCapsules,
    geneSerum,
    geneTierIndex,
    geneNodeIndex,
    geneStageFrom,
    geneStageTo,
    geneStageProgress,
    reformFrom,
    reformTo,
  };
  for (const [key, target] of Object.entries(numberRefs))
    if (typeof p[key] === "number") target.value = p[key];
  if (p.researchKind === "version" || p.researchKind === "evolution")
    researchKind.value = p.researchKind;
  if (p.beltType === "attack" || p.beltType === "defense")
    beltType.value = p.beltType;
  if (typeof p.balanced === "boolean") balanced.value = p.balanced;
  if (typeof p.geneStageActivated === "boolean")
    geneStageActivated.value = p.geneStageActivated;
  if (typeof p.simulationSeed === "string")
    simulationSeed.value = p.simulationSeed;
  if (p.masteryPrices && typeof p.masteryPrices === "object")
    Object.assign(masteryPrices, p.masteryPrices);
  if (typeof p.selectedChipName === "string")
    selectedChip.value =
      (
        (belt.value[beltType.value === "attack" ? "a" : "d"] ??
          []) as BeltChip[]
      ).find((chip) => chip.name === p.selectedChipName) ?? null;
  if (Array.isArray(p.comparedChipNames)) {
    const chips = [
      ...((belt.value.a ?? []) as BeltChip[]),
      ...((belt.value.d ?? []) as BeltChip[]),
    ];
    comparedChips.value = p.comparedChipNames
      .flatMap((name) =>
        typeof name === "string"
          ? chips.filter((chip) => chip.name === name)
          : [],
      )
      .slice(0, 2);
  }
  if (typeof p.selectedGraphEquipmentName === "string")
    selectedGraphEquipment.value =
      graphEquipment.value.find(
        (item) => item.name === p.selectedGraphEquipmentName,
      ) ?? null;
  if (Array.isArray(p.graphSelectedSkins))
    graphSelectedSkins.value = p.graphSelectedSkins.filter(
      (name): name is string => typeof name === "string",
    );
  const restoreGraphPortfolio = (
    target: Record<string, GraphRecipeState>,
    source: unknown,
  ) => {
    for (const key of Object.keys(target)) delete target[key];
    if (!source || typeof source !== "object") return;
    for (const [name, value] of Object.entries(source))
      if (value && typeof value === "object") {
        const state = value as Partial<GraphRecipeState>;
        target[name] = {
          star: Number(state.star) || 0,
          research: Number(state.research) || 0,
          mastery: Number(state.mastery) || 0,
          skins: Array.isArray(state.skins)
            ? state.skins.filter(
                (skin): skin is string => typeof skin === "string",
              )
            : [],
        };
      }
  };
  restoreGraphPortfolio(graphCurrentPortfolio, p.graphCurrentPortfolio);
  restoreGraphPortfolio(
    graphTargetPortfolio,
    p.graphTargetPortfolio ?? p.graphPortfolio,
  );
  if (Array.isArray(p.graphTargetLevels))
    p.graphTargetLevels.slice(0, graphTypes.length).forEach((value, index) => {
      if (typeof value === "number" && Number.isFinite(value))
        graphTargetLevels[index] = Math.max(1, Math.trunc(value));
    });
  graphPortfolioMode.value = "current";
  if (p.graphPrices && typeof p.graphPrices === "object")
    Object.assign(graphPrices, p.graphPrices);
}
</script>

<template>
  <section class="growth-workspace">
    <header class="growth-header">
      <h2>养成计算</h2>
    </header>
    <nav class="growth-tabs">
      <button
        v-for="tab in tabs"
        :key="tab[0]"
        :class="{ active: active === tab[0] }"
        @click="active = tab[0]"
      >
        {{ tab[1] }}
      </button>
    </nav>
    <section class="plan-bar">
      <form @submit.prevent="savePlan">
        <input
          v-model="planName"
          maxlength="200"
          placeholder="当前方案名称"
        /><button type="submit">保存当前方案</button>
      </form>
      <div v-if="modulePlans.length" class="plan-list">
        <span v-for="plan in modulePlans" :key="plan.id"
          ><button @click="applyPlan(plan)">{{ plan.name }}</button
          ><button class="plan-delete" @click="emit('deletePlan', plan.id)">
            ×
          </button></span
        >
      </div>
      <small v-else>当前模块暂无保存方案</small>
    </section>

    <div v-if="active === 'research'" class="growth-page">
      <section class="growth-controls">
        <label
          >类型<select v-model="researchKind">
            <option value="version">版本专研</option>
            <option value="evolution">进化专研</option>
          </select></label
        ><label
          >装备<select v-model.number="researchEquipmentIndex">
            <option
              v-for="(name, i) in researchEquipment"
              :key="name"
              :value="i"
            >
              {{ name }}
            </option>
          </select></label
        ><label
          >当前等级<input
            v-model.number="from"
            type="number"
            min="0"
            max="29" /></label
        ><label
          >目标等级<input
            v-model.number="to"
            type="number"
            min="1"
            max="30" /></label
        ><label
          >当前星级<input
            v-model.number="starFrom"
            type="number"
            min="0"
            max="4" /></label
        ><label
          >目标星级<input v-model.number="starTo" type="number" min="1" max="5"
        /></label>
      </section>
      <section class="probability-controls">
        <label
          >暴击 +1
          <input
            v-model.number="bonus1"
            type="number"
            min="0"
            max="100"
          />%</label
        ><label
          >暴击 +4
          <input
            v-model.number="bonus4"
            type="number"
            min="0"
            max="100"
          />%</label
        ><label
          >暴击 +9
          <input
            v-model.number="bonus9"
            type="number"
            min="0"
            max="100"
          />%</label
        ><span>无暴击 {{ 100 - bonus1 - bonus4 - bonus9 }}%</span>
      </section>
      <p v-if="progressionInputError" class="input-error" role="alert">
        {{ progressionInputError }}
      </p>
      <section class="simulation-bar">
        <label>模拟种子<input v-model="simulationSeed" /></label
        ><button @click="runResearchSimulation">运行可复现模拟</button
        ><span v-if="researchSimulation"
          >{{ researchSimulation.clicks }} 次 ·
          {{
            Object.entries(researchSimulation.outcomes)
              .map(([key, value]) => `${key} ${value}`)
              .join(" / ")
          }}</span
        >
      </section>
      <div class="result-cards">
        <article>
          <span>无暴击点击</span
          ><strong>{{ format(researchResult.deterministicClicks) }}</strong>
        </article>
        <article>
          <span>精确期望点击</span
          ><strong>{{ format(researchResult.expectedClicks) }}</strong>
        </article>
        <article
          v-for="(value, name) in researchResult.expectedMaterials"
          :key="name"
        >
          <span>期望{{ name }}</span
          ><strong>{{ format(value) }}</strong>
        </article>
        <article v-for="(value, name) in starResult" :key="`star-${name}`">
          <span>升星所需{{ name }}</span
          ><strong>{{ format(value) }}</strong>
        </article>
      </div>
      <div class="growth-columns">
        <details class="data-table collapsible-table">
          <summary>等级属性（按需展开）</summary>
          <div
            v-for="row in researchAttributes.slice(from, to + 1)"
            :key="row.level"
          >
            <strong>Lv {{ row.level }}</strong
            ><span>{{ JSON.parse(row.attr).join(" · ") }}</span>
          </div>
        </details>
        <section class="data-table">
          <h3>升星消耗</h3>
          <div v-for="row in starRows" :key="row.level">
            <strong>{{ row.level - 1 }} → {{ row.level }} 星</strong
            ><span>{{
              row.consumables
                .map((item) => `${item.name} ${item.num}`)
                .join(" · ")
            }}</span>
          </div>
        </section>
      </div>
    </div>

    <div v-else-if="active === 'mastery'" class="growth-page">
      <section class="growth-controls">
        <label
          >装备<select v-model.number="masteryEquipmentIndex">
            <option
              v-for="(name, i) in masteryEquipment"
              :key="name"
              :value="i"
            >
              {{ name }}
            </option>
          </select></label
        ><label v-if="masteryEquipmentIndex < 9"
          >版本装备等级<select v-model.number="masteryVersionLevelIndex">
            <option
              v-for="(level, index) in masteryVersionLevels"
              :key="level"
              :value="index"
            >
              {{ level }}级（专精上限 {{ masteryVersionCaps[index] }}）
            </option>
          </select></label
        ><label
          >当前专精<input
            v-model.number="masteryFrom"
            type="number"
            min="0"
            :max="Math.max(0, masteryLevelCap - 1)" /></label
        ><label
          >目标专精<input
            v-model.number="masteryTo"
            type="number"
            min="1"
            :max="masteryLevelCap" /></label
        ><label
          >装备单价<input
            v-model.number="equipmentUnitPrice"
            type="number"
            min="0" /></label
        ><label
          >小黄书单价<input
            v-model.number="bookUnitPrice"
            type="number"
            min="0" /></label
        ><label
          >半成品单价<input
            v-model.number="materialUnitPrice"
            type="number"
            min="0"
        /></label>
      </section>
      <p v-if="masteryInputError" class="input-error" role="alert">
        {{ masteryInputError }}
      </p>
      <p class="growth-note">
        本页固定提供完整无暴击预算：每 1
        点进度都会消耗一整套本级材料和本级金条。例如进度 60、单次 1 个半成品及
        800 金条，即合计 60 个半成品和 48,000 金条。关键等级同样按原表完整计入。
      </p>
      <details class="material-price-editor">
        <summary>按材料设置单价（用于准确估算金币成本）</summary>
        <div class="price-grid">
          <label v-for="name in masteryMaterialNames" :key="name"
            >{{ name
            }}<input
              v-model.number="masteryPrices[name]"
              type="number"
              min="0"
              :placeholder="String(masteryPrice(name))"
          /></label>
        </div>
      </details>
      <div class="result-cards">
        <article>
          <span>完整所需进度</span
          ><strong>{{ format(masteryResult.deterministicClicks) }}</strong>
        </article>
        <article>
          <span>完整预算折合金条</span
          ><strong>{{ format(masteryGoldCost) }}</strong>
        </article>
        <article
          v-for="(value, name) in masteryResult.deterministicMaterials"
          :key="name"
        >
          <span>共需{{ name }}</span
          ><strong>{{ format(value) }}</strong>
        </article>
      </div>
      <details class="attribute-comparison">
        <summary>查看专精属性变化</summary>
        <div>
          <section>
            <strong>当前 Lv {{ masteryFrom }}</strong
            ><span v-for="item in masteryCurrentAttributes" :key="item">{{
              item
            }}</span>
          </section>
          <section>
            <strong>目标 Lv {{ masteryTo }}</strong
            ><span v-for="item in masteryTargetAttributes" :key="item">{{
              item
            }}</span>
          </section>
        </div>
      </details>
      <details class="data-table collapsible-table">
        <summary>
          {{ masteryEquipment[masteryEquipmentIndex] }}逐级消耗（按需展开）
        </summary>
        <div
          v-for="row in masteryBase.slice(masteryFrom, masteryTo)"
          :key="row.level"
        >
          <strong>Lv {{ row.level }}</strong
          ><span
            >本级进度 {{ row.times }} · 合计
            {{
              row.consumables
                .map((item) => `${item.name} ${format(item.num * row.times)}`)
                .join(" · ")
            }}
            · 金条 {{ format((row.goldbar ?? 0) * row.times) }}（每点消耗：{{
              row.consumables
                .map((item) => `${item.name} ${item.num}`)
                .join(" · ")
            }}
            · 金条 {{ row.goldbar ?? 0 }}）</span
          >
        </div>
      </details>
    </div>

    <div v-else-if="active === 'accessory'" class="growth-page">
      <section class="growth-controls">
        <label
          >当前等级<input
            v-model.number="accessoryFrom"
            type="number"
            min="1"
            max="19" /></label
        ><label
          >目标等级<input
            v-model.number="accessoryTo"
            type="number"
            min="2"
            max="20"
        /></label>
      </section>
      <p v-if="accessoryInputError" class="input-error" role="alert">
        {{ accessoryInputError }}
      </p>
      <div class="result-cards">
        <article>
          <span>提升等级</span><strong>{{ accessoryResult.levels }}</strong>
        </article>
        <article>
          <span>所需机械材料</span
          ><strong>{{ format(accessoryResult.total) }}</strong>
        </article>
      </div>
      <details class="data-table collapsible-table">
        <summary>完整等级表（按需展开）</summary>
        <div v-for="(cost, i) in accessoryCosts" :key="i">
          <strong>Lv {{ i + 1 }} → {{ i + 2 }}</strong
          ><span
            >升级 {{ cost }} · 从1级累计
            {{
              accessoryCosts.slice(0, i + 1).reduce((a, b) => a + b, 0)
            }}</span
          >
        </div>
      </details>
    </div>

    <div v-else-if="active === 'belt'" class="growth-page">
      <section class="growth-controls">
        <label
          >芯片类型<select v-model="beltType">
            <option value="attack">攻击（42）</option>
            <option value="defense">防御（28）</option>
          </select></label
        ><label
          >当前星级<input
            v-model.number="beltFrom"
            type="number"
            min="1"
            max="11" /></label
        ><label
          >目标星级<input
            v-model.number="beltTo"
            type="number"
            min="2"
            max="12" /></label
        ><label
          >搜索芯片<input v-model="chipQuery" placeholder="芯片名称"
        /></label>
      </section>
      <p v-if="beltInputError" class="input-error" role="alert">
        {{ beltInputError }}
      </p>
      <div class="result-cards">
        <article>
          <span>升星所需元件</span><strong>{{ beltResult.total }}</strong>
        </article>
        <article>
          <span>提升星级</span><strong>{{ beltResult.levels }}</strong>
        </article>
      </div>
      <div class="chip-layout">
        <section class="chip-list">
          <button
            v-for="chip in beltChips"
            :key="chip.name"
            :class="{ active: selectedChip?.name === chip.name }"
            @click="selectedChip = chip"
          >
            {{ chip.name }}
          </button>
        </section>
        <section class="chip-detail">
          <template v-if="selectedChip"
            ><h3>{{ selectedChip.name }}</h3>
            <p>{{ selectedChip.type }} · {{ selectedChip.level }}</p>
            <label
              >查看星级<input
                v-model.number="chipLevel"
                type="range"
                min="1"
                max="12"
              /><strong>{{ chipLevel }} 星</strong></label
            >
            <p>{{ chipDescription }}</p>
            <button class="compare-action" @click="addComparedChip">
              加入芯片对比
            </button></template
          >
          <p v-else>选择芯片查看1至12星完整效果。</p>
        </section>
      </div>
      <section v-if="comparedChips.length" class="chip-comparison">
        <header>
          <h3>芯片效果对比 · {{ chipLevel }}星</h3>
          <button @click="comparedChips = []">清空</button>
        </header>
        <div>
          <article v-for="chip in comparedChips" :key="chip.name">
            <strong>{{ chip.name }}</strong
            ><span>{{ chip.type }} · {{ chip.level }}</span>
            <p>{{ resolveChipDescription(chip, chipLevel) }}</p>
            <button
              @click="
                comparedChips = comparedChips.filter(
                  (item) => item.name !== chip.name,
                )
              "
            >
              移除
            </button>
          </article>
        </div>
      </section>
    </div>

    <div v-else-if="active === 'graph'" class="growth-page">
      <section class="graph-flow-note">
        <strong>先录入现有配方，再选择目标图谱等级</strong>
        <span
          >目标只按等级设置；每件配方还能提供多少精通会直接显示在配方列表中。</span
        >
      </section>
      <section class="graph-category-tabs" aria-label="图谱分类">
        <button
          v-for="(name, i) in graphTypes"
          :key="name"
          :class="{ active: graphType === i }"
          @click="
            graphType = i;
            graphEquipmentQuery = '';
            selectedGraphEquipment = null;
          "
        >
          {{ name }}
          <small>{{ graphAllTypeSummary[i]?.current ?? 0 }} 精通</small>
        </button>
      </section>
      <section class="graph-toolbar">
        <label
          >搜索当前分类<input
            v-model="graphEquipmentQuery"
            placeholder="输入装备或涂装名称"
        /></label>
        <details>
          <summary>批量操作</summary>
          <div>
            <button @click="fillActiveGraphCategory(false)">
              拉满已录入配方
            </button>
            <button @click="fillActiveGraphCategory(true)">本类全部拉满</button>
            <button class="danger-action" @click="clearActiveGraphCategory">
              清空本类
            </button>
          </div>
        </details>
      </section>
      <div class="result-cards">
        <article>
          <span>当前图谱</span
          ><strong
            >Lv {{ graphCurrentPortfolioLevel }} ·
            {{ format(graphCurrentContribution) }}精通</strong
          >
        </article>
        <article>
          <label class="graph-target-level">
            <span>目标图谱等级</span>
            <select v-model.number="graphSelectedTargetLevel">
              <option
                v-for="row in graphLevels"
                :key="row.id"
                :value="row.id"
                :disabled="row.id < graphCurrentPortfolioLevel"
              >
                Lv {{ row.id }}
              </option>
            </select>
          </label>
        </article>
        <article>
          <span>目标等级门槛</span
          ><strong>{{ format(graphSelectedTargetScore) }}精通</strong>
        </article>
        <article>
          <span>距离目标还需</span
          ><strong>{{ format(graphSelectedNeededScore) }}精通</strong>
        </article>
      </div>
      <details class="graph-overview">
        <summary>查看七类图谱当前 → 目标总览</summary>
        <div>
          <article v-for="row in graphAllTypeSummary" :key="row.name">
            <strong>{{ row.name }}</strong
            ><span>Lv {{ row.currentLevel }} · {{ format(row.current) }}</span
            ><b>→</b
            ><span>Lv {{ row.targetLevel }} · {{ format(row.target) }}</span>
          </article>
        </div>
      </details>
      <details class="data-table collapsible-table">
        <summary>{{ graphTypes[graphType] }}完整属性（按需展开）</summary>
        <div v-for="row in graphLevels" :key="row.id">
          <strong>Lv {{ row.id }} · 精通 {{ row.exp }}</strong
          ><span>{{
            row.attrs
              .map(
                (item) =>
                  `${item.attr} ${item.percentage ? format(item.value * 100) + "%" : item.value}`,
              )
              .join(" · ")
          }}</span>
        </div>
      </details>
      <section class="equipment-catalog graph-recipe-grid">
        <h3>{{ graphTypes[graphType] }}配方</h3>
        <p class="growth-note">
          点击配方即录入并打开编辑；所有修改即时生效，无需另行保存。
        </p>
        <article
          v-for="item in graphEquipment"
          :key="item.name"
          :class="{
            active: selectedGraphEquipment?.name === item.name,
            configured: Boolean(activeGraphPortfolio[item.name]),
          }"
          tabindex="0"
          @click="selectGraphEquipment(item)"
          @keydown.enter="selectGraphEquipment(item)"
          @keydown.space.prevent="selectGraphEquipment(item)"
        >
          <strong>{{ item.name }}</strong>
          <small v-if="activeGraphPortfolio[item.name]">
            当前 {{ graphSavedContribution(item) }} · 满养成
            {{ graphMaxContribution(item) }}
          </small>
          <small v-else>
            未录入 · 可获得 {{ graphMaxContribution(item) }}精通
          </small>
          <span>
            还能增加
            {{
              format(graphMaxContribution(item) - graphSavedContribution(item))
            }}精通
          </span>
        </article>
      </section>
      <div
        v-if="selectedGraphEquipment"
        class="graph-editor-backdrop"
        @click.self="selectedGraphEquipment = null"
      >
        <section
          class="chip-detail graph-recipe-planner graph-editor-dialog"
          role="dialog"
          aria-modal="true"
          :aria-label="`${selectedGraphEquipment.name}配方详情`"
        >
          <button
            class="graph-editor-close"
            aria-label="关闭配方详情"
            @click="selectedGraphEquipment = null"
          >
            ×
          </button>
          <h3>{{ selectedGraphEquipment.name }} · 配方精通规划</h3>
          <div class="graph-progress-controls">
            <label
              v-if="(selectedGraphEquipment.max_star ?? 0) > 0"
              class="graph-progress-control"
            >
              <span
                ><b>星级</b
                ><output
                  >{{ graphRecipeStar }} /
                  {{ selectedGraphEquipment.max_star }}</output
                ></span
              ><input
                v-model.number="graphRecipeStar"
                type="range"
                min="0"
                :max="selectedGraphEquipment.max_star"
                step="1"
                @input="updateGraphRecipeStar"
            /></label>
            <label
              v-if="(selectedGraphEquipment.max_zy ?? 0) > 0"
              class="graph-progress-control"
            >
              <span
                ><b>专研</b
                ><output
                  >{{ graphRecipeResearch }} /
                  {{ selectedGraphEquipment.max_zy }}</output
                ></span
              ><input
                v-model.number="graphRecipeResearch"
                type="range"
                min="0"
                :max="selectedGraphEquipment.max_zy"
                step="1"
                @input="updateGraphRecipeResearch"
            /></label>
            <label
              v-if="(selectedGraphEquipment.max_zj ?? 0) > 0"
              class="graph-progress-control"
            >
              <span
                ><b>专精</b
                ><output
                  >{{ graphRecipeMastery }} /
                  {{ selectedGraphEquipment.max_zj }}</output
                ></span
              ><input
                v-model.number="graphRecipeMastery"
                type="range"
                min="0"
                :max="selectedGraphEquipment.max_zj"
                step="1"
                @input="updateGraphRecipeMastery"
            /></label>
            <div class="graph-unlock-rules">
              <strong>星级解锁规则</strong>
              <span>专研 0–10：无星级要求</span>
              <span
                >专研 11–15：1星 · 16–20：2星 · 21–25：3星 · 26–30：4星</span
              >
              <span v-if="(selectedGraphEquipment.max_zj ?? 0) > 0">
                专精 1–20：4星且专研满级 · 21级以上：5星且专研满级
              </span>
              <small>
                当前星级可用上限：专研 {{ graphSelectedResearchCap }} · 专精
                {{ graphSelectedMasteryCap }}
              </small>
            </div>
          </div>
          <fieldset
            v-if="selectedGraphEquipment.skin?.length"
            class="skin-selector"
          >
            <legend>选择实际已收集涂装</legend>
            <label v-for="skin in selectedGraphEquipment.skin" :key="skin.name"
              ><input
                v-model="graphSelectedSkins"
                type="checkbox"
                :value="skin.name"
                @change="saveGraphRecipe"
              />{{ skin.name }}（{{ skin.value ?? 0 }}精通）</label
            >
          </fieldset>
          <div class="result-cards">
            <article>
              <span>当前配方精通度</span
              ><strong>{{ graphRecipeContribution }}</strong>
            </article>
            <article>
              <span>本类当前总精通</span
              ><strong>{{ graphPortfolioContribution }}</strong>
            </article>
            <article>
              <span>本配方满养成精通</span
              ><strong>{{
                graphMaxContribution(selectedGraphEquipment)
              }}</strong>
            </article>
            <article>
              <span>本配方还能增加</span
              ><strong>{{
                format(
                  graphMaxContribution(selectedGraphEquipment) -
                    graphRecipeContribution,
                )
              }}</strong>
            </article>
          </div>
          <div class="graph-editor-actions">
            <button class="compare-action" @click="maxSelectedGraphRecipe">
              本配方全部拉满
            </button>
            <button class="danger-action" @click="removeSelectedGraphRecipe">
              从当前图谱移除
            </button>
          </div>
          <p class="growth-note">
            修改会立即计入当前图谱。通过上方“还能增加”可以直接判断这件配方对目标等级的帮助。
          </p>
        </section>
      </div>
      <details v-if="graphPortfolioItems.length" class="configured-recipes">
        <summary>已配置配方（{{ graphPortfolioItems.length }}）</summary>
        <div>
          <article v-for="entry in graphPortfolioItems" :key="entry.item.name">
            <button @click="selectGraphEquipment(entry.item)">
              <strong>{{ entry.item.name }}</strong
              ><span>{{ entry.contribution }}精通</span></button
            ><button @click="delete activeGraphPortfolio[entry.item.name]">
              移除
            </button>
          </article>
        </div>
      </details>
    </div>

    <div
      v-else-if="active === 'human' || active === 'half'"
      class="growth-page"
    >
      <section class="growth-controls">
        <label
          >单段目标进度<input
            v-model.number="geneProgress"
            type="number"
            min="0" /></label
        ><label
          >2倍概率<input
            v-model.number="gene2"
            type="number"
            min="0"
            max="100" /></label
        ><label
          >4倍概率<input
            v-model.number="gene4"
            type="number"
            min="0"
            max="100" /></label
        ><label
          >现有胶囊<input
            v-model.number="geneCapsules"
            type="number"
            min="0" /></label
        ><label
          >现有血清<input v-model.number="geneSerum" type="number" min="0"
        /></label>
      </section>
      <p v-if="geneInputError" class="input-error" role="alert">
        {{ geneInputError }}
      </p>
      <section class="simulation-bar">
        <label>模拟种子<input v-model="simulationSeed" /></label
        ><button @click="runGeneSimulation">运行可复现模拟</button
        ><span v-if="geneSimulation"
          >{{ geneSimulation.clicks }} 次 ·
          {{
            Object.entries(geneSimulation.outcomes)
              .map(([key, value]) => `${key} ${value}`)
              .join(" / ")
          }}</span
        >
      </section>
      <details class="node-planner">
        <summary>规划单个基因节点</summary>
        <div class="growth-controls">
          <label
            >潜能阶段<select v-model.number="geneTierIndex">
              <option
                v-for="(tier, index) in geneTiers"
                :key="tier.type"
                :value="index"
              >
                {{ tier.type }}
              </option>
            </select></label
          >
          <label
            >属性节点<select v-model.number="geneNodeIndex">
              <option
                v-for="(node, index) in selectedGeneTier?.attr_section"
                :key="node.id"
                :value="index"
              >
                {{ node.name }}
              </option>
            </select></label
          >
          <label
            >当前段<select v-model.number="geneStageFrom">
              <option
                v-for="(_, index) in selectedGeneTier?.attr_section_consumables"
                :key="index"
                :value="index"
              >
                第 {{ index + 1 }} 段
              </option>
            </select></label
          >
          <label
            >目标段<select v-model.number="geneStageTo">
              <option
                v-for="(_, index) in selectedGeneTier?.attr_section_consumables"
                :key="index"
                :value="index + 1"
                :disabled="index < geneStageFrom"
              >
                点满至第 {{ index + 1 }} 段
              </option>
            </select></label
          >
          <label
            >当前段进度<input
              v-model.number="geneStageProgress"
              type="number"
              min="0"
              :max="selectedGeneNode?.single_bar_score ?? 0"
          /></label>
          <label class="check-label"
            ><input
              v-model="geneStageActivated"
              type="checkbox"
            />当前段已激活</label
          >
        </div>
        <div class="result-cards">
          <article>
            <span>无暴击点击预算</span
            ><strong>{{ format(geneNodePlan.deterministicClicks) }}</strong>
          </article>
          <article>
            <span>精确期望点击</span
            ><strong>{{ format(geneNodePlan.expectedClicks) }}</strong>
          </article>
          <article v-for="(amount, name) in geneNodePlan.materials" :key="name">
            <span>预计{{ name }}</span
            ><strong>{{ format(amount) }}</strong>
          </article>
        </div>
      </details>
      <div class="result-cards">
        <article>
          <span>单段精确期望点击</span
          ><strong>{{ format(geneExpected) }}</strong>
        </article>
        <article>
          <span>{{
            active === "half" ? "逐段保守期望点击" : "全部普通节点期望点击"
          }}</span
          ><strong>{{ format(geneFullTotals.expectedClicks) }}</strong>
        </article>
        <article v-for="(amount, name) in geneFullTotals.materials" :key="name">
          <span>{{ active === "half" ? "逐段预算" : "预计" }}{{ name }}</span
          ><strong
            >{{ format(amount) }} ·
            {{
              geneInventoryEnough[name as "胶囊" | "血清"] === false
                ? "不足"
                : "充足"
            }}</strong
          >
        </article>
        <article>
          <span>无暴击概率</span><strong>{{ 100 - gene2 - gene4 }}%</strong>
        </article>
      </div>
      <details
        v-for="(tierRow, tierIndex) in geneTierTotals"
        :key="tierRow.tier.type"
        class="gene-tier collapsible-tier"
      >
        <summary>
          {{ tierRow.tier.type }} · 预计 {{ format(tierRow.expectedClicks) }} 次
        </summary>
        <p class="growth-note">
          本级点满预计 {{ format(tierRow.expectedClicks) }} 次 ·
          {{
            Object.entries(tierRow.materials)
              .map(([name, value]) => `${name} ${format(value)}`)
              .join(" · ")
          }}
        </p>
        <div v-if="tierRow.tier.key_section" class="gene-key">
          <strong>{{ tierRow.tier.key_section.name }}</strong>
          <details v-for="(entry, i) in tierRow.tier.key_section.attr" :key="i">
            <summary>
              特技 {{ i + 1 }} · 养成度 {{ entry.limit_score ?? 0 }} ·
              {{ entry.consumables?.name }} {{ entry.consumables?.num }}
            </summary>
            <p>{{ cleanHtml(entry.description) }}</p>
          </details>
        </div>
        <div class="gene-grid">
          <article v-for="node in tierRow.tier.attr_section" :key="node.id">
            <strong>{{ node.name }}</strong
            ><span>{{ node.attr }}</span
            ><small
              >每段上限 {{ node.single_bar_score }}进度 · 满段属性
              {{
                node.percentage
                  ? format(node.single_bar_value * 100) + "%"
                  : node.single_bar_value
              }}</small
            ><small
              v-for="(cost, costIndex) in tierRow.tier.attr_section_consumables"
              :key="costIndex"
              >第 {{ costIndex + 1 }} 段：激活 {{ cost.active.cond.name }}
              {{ cost.active.cond.num }}（+{{ cost.active.score }}）· 增强
              {{ cost.single.cond.name }} {{ cost.single.cond.num }}（+{{
                cost.single.score
              }}）</small
            >
          </article>
        </div>
        <details class="gene-thresholds">
          <summary>
            养成度阶段属性（{{ tierRow.tier.score_attr?.length ?? 0 }}档）
          </summary>
          <p v-for="entry in tierRow.tier.score_attr" :key="entry.limit_score">
            <strong>{{ entry.limit_score }}</strong
            >：{{
              entry.attrs
                .map((item) => `${item.attr} ${item.value}`)
                .join(" · ")
            }}
          </p>
        </details>
      </details>
    </div>

    <div v-else class="growth-page">
      <section class="growth-controls">
        <label
          >当前阶段<select v-model.number="reformFrom">
            <option v-for="(row, i) in reformRows" :key="i" :value="i">
              {{ row.level.join(" / ") }}
            </option>
          </select></label
        ><label
          >目标阶段<select v-model.number="reformTo">
            <option v-for="(row, i) in reformRows" :key="i" :value="i + 1">
              {{ row.level.join(" / ") }}
            </option>
          </select></label
        ><label class="check-label"
          ><input
            v-model="balanced"
            type="checkbox"
          />武器、护甲、头盔均衡提升（×3）</label
        >
      </section>
      <p v-if="reformInputError" class="input-error" role="alert">
        {{ reformInputError }}
      </p>
      <p class="growth-note">
        采用原项目保守估计：不计约0.4%～0.5%的改造暴击，包含每阶段工艺晋级点击。
      </p>
      <div class="result-cards">
        <article>
          <span>点击次数</span><strong>{{ reformResult.clicks }}</strong>
        </article>
        <article>
          <span>重构分子</span
          ><strong>{{ format(reformResult.molecule) }}</strong>
        </article>
        <article>
          <span>纳米3</span><strong>{{ format(reformResult.nano3) }}</strong>
        </article>
        <article>
          <span>金条</span><strong>{{ format(reformResult.gold) }}</strong>
        </article>
      </div>
      <details class="data-table collapsible-table">
        <summary>完整工艺阶段表（{{ reformRows.length }}项，按需展开）</summary>
        <div v-for="(row, i) in reformRows" :key="i">
          <strong>{{ row.level.join(" / ") }}</strong
          ><span
            >进度 {{ row.times }} · 每次：分子 {{ row.molecule }} / 纳米3
            {{ row.nano }} / 金条 {{ row.goldbar }}</span
          >
        </div>
      </details>
    </div>
  </section>
</template>
