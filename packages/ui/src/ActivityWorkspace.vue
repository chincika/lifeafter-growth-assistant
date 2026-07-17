<script setup lang="ts">
import { computed, ref } from "vue";

interface Category { id: string; name: string; sortOrder: number }
interface Activity { id: string; category: string; categoryName: string; title: string; version: string; condition: string; floors: number | null; startDate?: string; endDate?: string; rawStart: string; rawEnd: string }
const props = defineProps<{ categories: Category[]; entries: Activity[] }>();
const selectedCategory = ref(props.categories[0]?.id ?? "");
const status = ref<"current" | "upcoming" | "history" | "all">("current");
const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Shanghai" });
function dayNumber(value?: string) { return value ? Math.floor(Date.parse(`${value}T00:00:00Z`) / 86_400_000) : null; }
function activityStatus(entry: Activity) {
  const now = dayNumber(today)!;
  const start = dayNumber(entry.startDate);
  const end = dayNumber(entry.endDate);
  if (start !== null && now < start) return "upcoming";
  if (end !== null && now > end) return "history";
  if (start !== null && now >= start && (end === null || now <= end)) return "current";
  return "history";
}
function countdown(entry: Activity) {
  const now = dayNumber(today)!;
  const start = dayNumber(entry.startDate);
  const end = dayNumber(entry.endDate);
  const state = activityStatus(entry);
  if (state === "upcoming" && start !== null) return `${start - now} 天后开始`;
  if (state === "current" && end !== null) return `剩余 ${end - now + 1} 天`;
  if (state === "current") return "进行中 · 结束时间待定";
  if (end !== null) return `已结束 ${now - end} 天`;
  return "历史资料";
}
const visible = computed(() => props.entries
  .filter((entry) => entry.category === selectedCategory.value)
  .filter((entry) => status.value === "all" || activityStatus(entry) === status.value)
  .sort((a, b) => (b.startDate ?? "").localeCompare(a.startDate ?? "")));
</script>

<template>
  <section class="module-workspace">
    <header class="page-header"><div><span class="eyebrow">日期按自然日计算</span><h2>活动计时器</h2><p>完整保留原版八类活动历史；当前内置资料只作参考，最终以游戏官方公告为准。</p></div><div class="summary-chip">今天 <strong>{{ today }}</strong></div></header>
    <div class="category-tabs"><button v-for="category in categories" :key="category.id" type="button" :class="{active:selectedCategory===category.id}" @click="selectedCategory=category.id">{{ category.name }}<small>{{ entries.filter((entry)=>entry.category===category.id).length }}</small></button></div>
    <div class="segmented activity-status"><button v-for="option in [{id:'current',name:'进行中'},{id:'upcoming',name:'即将开始'},{id:'history',name:'历史'},{id:'all',name:'全部'}]" :key="option.id" type="button" :class="{selected:status===option.id}" @click="status=option.id as typeof status">{{ option.name }}</button></div>
    <section class="activity-list"><article v-for="entry in visible" :key="entry.id" :class="['activity-card',activityStatus(entry)]"><header><div><span>{{ entry.version || entry.categoryName }}</span><h3>{{ entry.title }}</h3></div><strong>{{ countdown(entry) }}</strong></header><dl><div><dt>开始</dt><dd>{{ entry.rawStart || '待定' }}</dd></div><div><dt>结束</dt><dd>{{ entry.rawEnd || '待定' }}</dd></div><div v-if="entry.floors"><dt>层数</dt><dd>{{ entry.floors }}</dd></div><div v-if="entry.condition"><dt>条件</dt><dd>{{ entry.condition }}</dd></div></dl></article><p v-if="!visible.length" class="state-message">这个分类下没有对应状态的记录，可切换“历史”或“全部”查看。</p></section>
  </section>
</template>
