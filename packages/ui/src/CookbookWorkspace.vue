<script setup lang="ts">
import { computed, ref } from "vue";

export interface CookbookRecipe { id: string; position: number; name: string; method: string; effect: string; duration: string; unlocked: boolean }
const props = defineProps<{ recipes: CookbookRecipe[] }>();
const emit = defineEmits<{ setUnlock: [input: { id: string; unlocked: boolean }] }>();
const query = ref("");
const unlockFilter = ref<"all" | "unlocked" | "locked">("all");
const selectedEffects = ref<string[]>([]);
const showEffects = ref(false);
const selectedId = ref<string | null>(null);

const effectGroups = [
  { name: "伤害属性", values: ["污染怪", "人型怪", "动物", "建筑", "暴击率", "免暴率", "头部伤害"] },
  { name: "战斗属性", values: ["战斗熟练度", "射速", "射程", "换弹速度", "挥砍速度", "弹药携带量", "气力上限"] },
  { name: "采集属性", values: ["伐木速度", "伐木主资源", "伐木副资源", "挖矿速度", "挖矿主资源", "挖矿副资源", "采麻速度", "采麻主资源", "采麻副资源", "采集熟练度"] },
  { name: "其他属性", values: ["移动速度", "游泳速度", "制作速度", "奔跑消耗", "血量上限", "持续回复血量", "稳定性", "恶劣环境抵抗", "体温提升", "体温降低", "去除感冒"] },
];
const filtered = computed(() => {
  const keyword = query.value.trim().toLocaleLowerCase("zh-CN");
  return props.recipes.filter((recipe) =>
    (!keyword || recipe.name.toLocaleLowerCase("zh-CN").includes(keyword) || recipe.method.toLocaleLowerCase("zh-CN").includes(keyword)) &&
    (unlockFilter.value === "all" || (unlockFilter.value === "unlocked") === recipe.unlocked) &&
    selectedEffects.value.every((effect) => recipe.effect.includes(effect)),
  );
});
const selectedIndex = computed(() => filtered.value.findIndex((recipe) => recipe.id === selectedId.value));
const selected = computed(() => filtered.value[selectedIndex.value] ?? null);
const unlockedCount = computed(() => props.recipes.filter((recipe) => recipe.unlocked).length);
function toggleEffect(effect: string) { selectedEffects.value = selectedEffects.value.includes(effect) ? selectedEffects.value.filter((item) => item !== effect) : [...selectedEffects.value, effect]; }
function move(offset: number) { if (!filtered.value.length) return; const next = Math.min(filtered.value.length - 1, Math.max(0, selectedIndex.value + offset)); selectedId.value = filtered.value[next]?.id ?? null; }
function setUnlock(unlocked: boolean) { if (selected.value) emit("setUnlock", { id: selected.value.id, unlocked }); }
</script>

<template>
  <section class="module-workspace">
    <header class="page-header"><div><span class="eyebrow">566 条原版资料</span><h2>食谱大全</h2><p>按名称、食材或组合效果筛选；解锁状态自动保存在本机。</p></div><div class="summary-chip">已解锁 <strong>{{ unlockedCount }}</strong> / {{ recipes.length }}</div></header>
    <section class="controls module-controls"><label class="grow-control">食谱或食材<input v-model="query" type="search" placeholder="例如：水果、蜂蜜、果酱"></label><label>解锁状态<select v-model="unlockFilter"><option value="all">全部</option><option value="unlocked">已解锁</option><option value="locked">未解锁</option></select></label><button type="button" class="secondary-button" @click="showEffects=!showEffects">{{ showEffects ? '收起效果筛选' : '展开效果筛选' }}</button></section>
    <section v-if="showEffects" class="effect-filter"><article v-for="group in effectGroups" :key="group.name"><strong>{{ group.name }}</strong><div><button v-for="effect in group.values" :key="effect" type="button" :class="{selected:selectedEffects.includes(effect)}" @click="toggleEffect(effect)">{{ effect }}</button></div></article><button v-if="selectedEffects.length" type="button" class="link-button" @click="selectedEffects=[]">清空组合条件</button></section>
    <p class="module-count">筛选结果 {{ filtered.length }} 条</p>
    <section class="recipe-gallery">
      <button v-for="recipe in filtered" :key="recipe.id" type="button" :class="['recipe-card',{unlocked:recipe.unlocked}]" @click="selectedId=recipe.id"><span>{{ recipe.unlocked ? '已解锁' : '未解锁' }}</span><strong>{{ recipe.name }}</strong><small>{{ recipe.method }}</small></button>
    </section>
    <p v-if="!filtered.length" class="state-message">没有符合全部条件的食谱</p>
    <div v-if="selected" class="modal-backdrop" @click.self="selectedId=null"><section class="recipe-detail-modal"><header><div><span class="eyebrow">序号 {{ selected.position + 1 }} · {{ selectedIndex + 1 }} / {{ filtered.length }}</span><h2>{{ selected.name }}</h2></div><button class="close-button" type="button" @click="selectedId=null">×</button></header><dl><div><dt>获得方法</dt><dd>{{ selected.method }}</dd></div><div><dt>食用效果</dt><dd class="pre-line">{{ selected.effect }}</dd></div><div><dt>持续时间</dt><dd>{{ selected.duration }}</dd></div></dl><div class="detail-navigation"><button type="button" class="secondary-button" :disabled="selectedIndex<=0" @click="move(-1)">上一条</button><div class="segmented"><button type="button" :class="{selected:!selected.unlocked}" @click="setUnlock(false)">未解锁</button><button type="button" :class="{selected:selected.unlocked}" @click="setUnlock(true)">已解锁</button></div><button type="button" class="secondary-button" :disabled="selectedIndex>=filtered.length-1" @click="move(1)">下一条</button></div></section></div>
  </section>
</template>
