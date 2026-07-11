<script setup lang="ts">
import { computed, ref } from "vue";
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
  if (masteryEquipmentIndex.value < 9)
    return (progression.value.V ?? []) as ProgressLevel[];
  const base = structuredClone((progression.value.B ?? []) as ProgressLevel[]);
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
const masteryGoldCost = computed(() =>
  Object.entries(masteryResult.value.expectedMaterials).reduce(
    (sum, [name, amount]) =>
      sum +
      amount *
        (name === "小黄书"
          ? bookUnitPrice.value
          : name === "金条"
            ? 1
            : name.includes("枪") ||
                name.includes("刀") ||
                name.includes("盾") ||
                name.includes("甲") ||
                name.includes("弓") ||
                name.includes("炮")
              ? equipmentUnitPrice.value
              : materialUnitPrice.value),
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
const beltChips = computed(() =>
  (
    (belt.value[beltType.value === "attack" ? "a" : "d"] ?? []) as BeltChip[]
  ).filter((chip) => chip.name.includes(chipQuery.value.trim())),
);
const selectedChip = ref<BeltChip | null>(null),
  chipLevel = ref(1);
const chipLevelText = computed(
  () => selectedChip.value?.[`attr_${chipLevel.value}`] as string[] | undefined,
);

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
const graphEquipmentQuery = ref("");
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
  ).filter((item) => item.name.includes(graphEquipmentQuery.value.trim())),
);
type GraphEquipment = (typeof graphEquipment.value)[number];
const selectedGraphEquipment = ref<GraphEquipment | null>(null);
const graphRecipeStar = ref(0),
  graphRecipeResearch = ref(0),
  graphRecipeMastery = ref(0),
  graphRecipeSkins = ref(0);
const graphStarTables = computed(() => (graph.value.Ce_0 ?? []) as number[][]);
const graphResearchTables = computed(
  () => (graph.value.Ue_0 ?? []) as number[][],
);
const graphMasteryTables = computed(
  () => (graph.value.Ee_0 ?? []) as number[][],
);
function tableValue(table: number[] | undefined, level: number) {
  return table?.[Math.max(0, Math.min(level, (table?.length ?? 1) - 1))] ?? 0;
}
const graphRecipeContribution = computed(() => {
  const item = selectedGraphEquipment.value;
  if (!item) return 0;
  const init = item.init_value;
  const starIndex = (
    { 40: 0, 45: 1, 50: 2, 55: 3, 60: 4, 65: 5 } as Record<number, number>
  )[init];
  const researchIndex = (
    { 40: 0, 45: 1, 50: 2, 55: 3, 60: 4, 65: 5 } as Record<number, number>
  )[init];
  const masteryIndex = (
    { 45: 0, 55: 1, 60: 2, 65: 3 } as Record<number, number>
  )[init];
  const base =
    item.max_star && item.max_star >= 3 && starIndex !== undefined
      ? tableValue(graphStarTables.value[starIndex], graphRecipeStar.value)
      : init;
  const levelValue =
    item.max_zj && item.max_zj > 0 && masteryIndex !== undefined
      ? tableValue(
          graphMasteryTables.value[masteryIndex],
          graphRecipeMastery.value,
        )
      : researchIndex !== undefined
        ? tableValue(
            graphResearchTables.value[researchIndex],
            graphRecipeResearch.value,
          )
        : 0;
  const skinValue = (item.skin ?? [])
    .slice(0, graphRecipeSkins.value)
    .reduce((sum, skin) => sum + (skin.value ?? 0), 0);
  return base + levelValue + skinValue;
});
function selectGraphEquipment(item: GraphEquipment) {
  selectedGraphEquipment.value = item;
  graphRecipeStar.value = 0;
  graphRecipeResearch.value = 0;
  graphRecipeMastery.value = 0;
  graphRecipeSkins.value = 0;
}

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
const geneCapsules = ref(9999),
  geneSerum = ref(999999);
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
    bonus1: bonus1.value,
    bonus4: bonus4.value,
    bonus9: bonus9.value,
    simulationSeed: simulationSeed.value,
    masteryEquipmentIndex: masteryEquipmentIndex.value,
    masteryFrom: masteryFrom.value,
    masteryTo: masteryTo.value,
    equipmentUnitPrice: equipmentUnitPrice.value,
    bookUnitPrice: bookUnitPrice.value,
    materialUnitPrice: materialUnitPrice.value,
    accessoryFrom: accessoryFrom.value,
    accessoryTo: accessoryTo.value,
    beltFrom: beltFrom.value,
    beltTo: beltTo.value,
    beltType: beltType.value,
    selectedChipName: selectedChip.value?.name,
    chipLevel: chipLevel.value,
    graphType: graphType.value,
    graphFrom: graphFrom.value,
    graphTo: graphTo.value,
    selectedGraphEquipmentName: selectedGraphEquipment.value?.name,
    graphRecipeStar: graphRecipeStar.value,
    graphRecipeResearch: graphRecipeResearch.value,
    graphRecipeMastery: graphRecipeMastery.value,
    graphRecipeSkins: graphRecipeSkins.value,
    geneProgress: geneProgress.value,
    gene2: humanGene2.value,
    gene4: humanGene4.value,
    halfGene2: halfGene2.value,
    halfGene4: halfGene4.value,
    geneCapsules: geneCapsules.value,
    geneSerum: geneSerum.value,
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
    bonus1,
    bonus4,
    bonus9,
    masteryEquipmentIndex,
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
    graphRecipeSkins,
    geneProgress,
    gene2: humanGene2,
    gene4: humanGene4,
    halfGene2,
    halfGene4,
    geneCapsules,
    geneSerum,
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
  if (typeof p.simulationSeed === "string")
    simulationSeed.value = p.simulationSeed;
  if (typeof p.selectedChipName === "string")
    selectedChip.value =
      (
        (belt.value[beltType.value === "attack" ? "a" : "d"] ??
          []) as BeltChip[]
      ).find((chip) => chip.name === p.selectedChipName) ?? null;
  if (typeof p.selectedGraphEquipmentName === "string")
    selectedGraphEquipment.value =
      graphEquipment.value.find(
        (item) => item.name === p.selectedGraphEquipmentName,
      ) ?? null;
}
</script>

<template>
  <section class="growth-workspace">
    <header class="growth-header">
      <div>
        <span class="eyebrow">本地养成规划</span>
        <h2>养成计算</h2>
        <p>旧版完整资料已离线迁移；确定性成本、精确期望和资料说明分开呈现。</p>
      </div>
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
          >目标等级<input v-model.number="to" type="number" min="1" max="30"
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
      </div>
      <div class="growth-columns">
        <section class="data-table">
          <h3>等级属性</h3>
          <div
            v-for="row in researchAttributes.slice(from, to + 1)"
            :key="row.level"
          >
            <strong>Lv {{ row.level }}</strong
            ><span>{{ JSON.parse(row.attr).join(" · ") }}</span>
          </div>
        </section>
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
        ><label
          >当前专精<input
            v-model.number="masteryFrom"
            type="number"
            min="0"
            max="34" /></label
        ><label
          >目标专精<input
            v-model.number="masteryTo"
            type="number"
            min="1"
            max="35" /></label
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
      <p class="growth-note">
        关键等级 3、8、13、18、23、28、33
        按原规则禁止暴击；缺失和估算条目保留原版标注。
      </p>
      <div class="result-cards">
        <article>
          <span>无暴击点击</span
          ><strong>{{ format(masteryResult.deterministicClicks) }}</strong>
        </article>
        <article>
          <span>精确期望点击</span
          ><strong>{{ format(masteryResult.expectedClicks) }}</strong>
        </article>
        <article>
          <span>预计金币成本</span
          ><strong>{{ format(masteryGoldCost) }}</strong>
        </article>
        <article
          v-for="(value, name) in masteryResult.expectedMaterials"
          :key="name"
        >
          <span>期望{{ name }}</span
          ><strong>{{ format(value) }}</strong>
        </article>
      </div>
      <section class="data-table">
        <h3>{{ masteryEquipment[masteryEquipmentIndex] }}逐级消耗</h3>
        <div
          v-for="row in masteryBase.slice(masteryFrom, masteryTo)"
          :key="row.level"
        >
          <strong>Lv {{ row.level }}</strong
          ><span
            >进度 {{ row.times }} ·
            {{
              row.consumables
                .map((item) => `${item.name} ${item.num}`)
                .join(" · ")
            }}
            · 金条 {{ row.goldbar }}</span
          >
        </div>
      </section>
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
      <div class="result-cards">
        <article>
          <span>提升等级</span><strong>{{ accessoryResult.levels }}</strong>
        </article>
        <article>
          <span>所需机械材料</span
          ><strong>{{ format(accessoryResult.total) }}</strong>
        </article>
      </div>
      <section class="data-table">
        <h3>完整等级表</h3>
        <div v-for="(cost, i) in accessoryCosts" :key="i">
          <strong>Lv {{ i + 1 }} → {{ i + 2 }}</strong
          ><span
            >升级 {{ cost }} · 从1级累计
            {{
              accessoryCosts.slice(0, i + 1).reduce((a, b) => a + b, 0)
            }}</span
          >
        </div>
      </section>
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
            <p>{{ cleanHtml(selectedChip.attr) }}</p>
            <ul>
              <li v-for="text in chipLevelText" :key="text">{{ text }}</li>
            </ul></template
          >
          <p v-else>选择芯片查看1至12星完整效果。</p>
        </section>
      </div>
    </div>

    <div v-else-if="active === 'graph'" class="growth-page">
      <section class="growth-controls">
        <label
          >图谱<select v-model.number="graphType">
            <option v-for="(name, i) in graphTypes" :key="name" :value="i">
              {{ name }}
            </option>
          </select></label
        ><label
          >当前等级<input
            v-model.number="graphFrom"
            type="number"
            min="1"
            max="9" /></label
        ><label
          >目标等级<input
            v-model.number="graphTo"
            type="number"
            min="1"
            max="9" /></label
        ><label
          >搜索配方<input
            v-model="graphEquipmentQuery"
            placeholder="装备或涂装"
        /></label>
      </section>
      <div class="result-cards">
        <article>
          <span>当前精通度</span><strong>{{ graphCurrent?.exp }}</strong>
        </article>
        <article>
          <span>目标精通度</span><strong>{{ graphTarget?.exp }}</strong>
        </article>
        <article>
          <span>还需精通度</span
          ><strong>{{
            Math.max(0, (graphTarget?.exp ?? 0) - (graphCurrent?.exp ?? 0))
          }}</strong>
        </article>
        <article>
          <span>本类配方</span><strong>{{ graphEquipment.length }}</strong>
        </article>
      </div>
      <section class="data-table">
        <h3>{{ graphTypes[graphType] }}完整属性</h3>
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
      </section>
      <section
        v-if="selectedGraphEquipment"
        class="chip-detail graph-recipe-planner"
      >
        <h3>{{ selectedGraphEquipment.name }} · 配方精通规划</h3>
        <div class="growth-controls">
          <label v-if="(selectedGraphEquipment.max_star ?? 0) > 0"
            >星级<input
              v-model.number="graphRecipeStar"
              type="number"
              min="0"
              :max="selectedGraphEquipment.max_star"
          /></label>
          <label v-if="(selectedGraphEquipment.max_zy ?? 0) > 0"
            >专研<input
              v-model.number="graphRecipeResearch"
              type="number"
              min="0"
              :max="selectedGraphEquipment.max_zy"
          /></label>
          <label v-if="(selectedGraphEquipment.max_zj ?? 0) > 0"
            >专精<input
              v-model.number="graphRecipeMastery"
              type="number"
              min="0"
              :max="selectedGraphEquipment.max_zj"
          /></label>
          <label v-if="selectedGraphEquipment.skin?.length"
            >已收集涂装<input
              v-model.number="graphRecipeSkins"
              type="number"
              min="0"
              :max="selectedGraphEquipment.skin.length"
          /></label>
        </div>
        <div class="result-cards">
          <article>
            <span>当前配方精通度</span
            ><strong>{{ graphRecipeContribution }}</strong>
          </article>
          <article>
            <span>距图谱目标尚差</span
            ><strong>{{
              Math.max(0, (graphTarget?.exp ?? 0) - graphRecipeContribution)
            }}</strong>
          </article>
        </div>
        <p class="growth-note">
          精通度严格按原版的初始值、升星表、专研/专精表及涂装收集值计算。涂装按资料顺序计入，可在下方核对具体数值。
        </p>
      </section>
      <section class="equipment-catalog">
        <h3>{{ graphTypes[graphType] }}配方与涂装资料</h3>
        <article
          v-for="item in graphEquipment"
          :key="item.name"
          :class="{ active: selectedGraphEquipment?.name === item.name }"
          @click="selectGraphEquipment(item)"
        >
          <strong>{{ item.name }}</strong
          ><span
            >初始精通 {{ item.init_value }} · 升星 {{ item.max_star ?? "—" }} ·
            专研 {{ item.max_zy ?? "—" }} · 专精 {{ item.max_zj ?? "—" }}</span
          ><small v-if="item.skin?.length"
            >涂装：{{ item.skin.map((skin) => skin.name).join("、") }}</small
          >
        </article>
      </section>
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
      <section
        v-for="(tierRow, tierIndex) in geneTierTotals"
        :key="tierRow.tier.type"
        class="gene-tier"
      >
        <h3>{{ tierRow.tier.type }}</h3>
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
      </section>
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
      <section class="data-table">
        <h3>完整工艺阶段表（{{ reformRows.length }}项）</h3>
        <div v-for="(row, i) in reformRows" :key="i">
          <strong>{{ row.level.join(" / ") }}</strong
          ><span
            >进度 {{ row.times }} · 每次：分子 {{ row.molecule }} / 纳米3
            {{ row.nano }} / 金条 {{ row.goldbar }}</span
          >
        </div>
      </section>
    </div>
  </section>
</template>
