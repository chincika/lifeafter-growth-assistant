<script setup lang="ts">
import { computed, ref } from "vue";
import { calculateLegacyNanoMetrics } from "@lifeafter-assistant/core";

interface NanoRange { min: number; max: number; average: number }
interface MarketItem {
  id: string; name: string; resourceType: number; level: number; couponCost: number;
  marketPrice: number | null;
  recipe: Array<{ ingredientId: string; quantity: number; acquisitionMode: "craft" | "purchase" }>;
  nano?: { nano1: NanoRange; nano2: NanoRange; nano3: NanoRange } | null;
}

const props = defineProps<{ items: MarketItem[] }>();
const type = ref<"nano1" | "nano2" | "nano3" | "research">("nano1");
const sort = ref<"coupon" | "purchase" | "amount">("coupon");
const query = ref("");
const minLevel = ref(0);
const maxLevel = ref(16);
const onlyAvailable = ref(true);
const convertProcessingCost = ref(true);
const itemIndex = computed(() => new Map(props.items.map((item) => [item.id, item])));

function costOf(item: MarketItem, path: string[] = []): { coupon: number; gold: number; complete: boolean } {
  if (item.resourceType <= 4) return { coupon: item.couponCost, gold: 0, complete: true };
  if (path.includes(item.id)) return { coupon: 0, gold: 0, complete: false };
  let coupon = 0, gold = 0, complete = true;
  for (const ingredient of item.recipe) {
    const child = itemIndex.value.get(ingredient.ingredientId);
    if (!child) { complete = false; continue; }
    if (ingredient.acquisitionMode === "craft") {
      const childCost = costOf(child, [...path, item.id]);
      coupon += childCost.coupon * ingredient.quantity;
      gold += childCost.gold * ingredient.quantity;
      complete &&= childCost.complete;
    } else if (child.marketPrice === null) complete = false;
    else gold += child.marketPrice * ingredient.quantity;
  }
  return { coupon, gold, complete };
}

function metrics(item: MarketItem) {
  const range = type.value === "research" ? item.nano?.nano2 : item.nano?.[type.value];
  const cost = costOf(item);
  const calculated = calculateLegacyNanoMetrics({ type: type.value, average: range?.average ?? 0, nano2Average: item.nano?.nano2.average ?? 0, couponCost: cost.coupon, processingGoldCost: cost.gold, marketPrice: item.marketPrice, convertNano3ProcessingCost: convertProcessingCost.value });
  return { range, amount: calculated.amount, coupon: calculated.effectiveCouponCost, gold: cost.gold, complete: cost.complete, couponRatio: calculated.couponRatio, purchaseRatio: calculated.purchaseRatio };
}

const visible = computed(() => {
  const keyword = query.value.trim().toLocaleLowerCase("zh-CN");
  return props.items
    .filter((item) => item.nano && item.level >= minLevel.value && item.level <= maxLevel.value)
    .filter((item) => !keyword || item.name.toLocaleLowerCase("zh-CN").includes(keyword))
    .filter((item) => !onlyAvailable.value || metrics(item).amount > 0)
    .sort((a, b) => {
      const left = metrics(a), right = metrics(b);
      const value = sort.value === "coupon" ? right.couponRatio - left.couponRatio
        : sort.value === "purchase" ? right.purchaseRatio - left.purchaseRatio
        : type.value === "research" ? left.amount - right.amount : right.amount - left.amount;
      return value || a.level - b.level || a.name.localeCompare(b.name, "zh-CN");
    });
});
</script>

<template>
  <section class="module-workspace">
    <header class="page-header">
      <div><span class="eyebrow">原版计算机制</span><h2>纳米塑材收益</h2><p>比较采集券兑换、市场直购与专研点击效率；售价与材料获取方式沿用地摊中的个人数据。</p></div>
      <input v-model="query" class="search-input" type="search" placeholder="搜索材料…">
    </header>
    <section class="controls module-controls">
      <label>纳米类型<select v-model="type"><option value="nano1">纳米塑材 I</option><option value="nano2">纳米塑材 II</option><option value="nano3">纳米塑材 III</option><option value="research">专研 · 纳米 II</option></select></label>
      <label>排序依据<select v-model="sort"><option value="coupon">券收益比</option><option value="purchase">直购收益比</option><option value="amount">纳米数量 / 点击数</option></select></label>
      <label>最低等级<input v-model.number="minLevel" type="number" min="0" max="16"></label>
      <label>最高等级<input v-model.number="maxLevel" type="number" min="0" max="16"></label>
      <label class="check-control"><input v-model="onlyAvailable" type="checkbox">只显示有产出的材料</label>
      <label v-if="type==='nano3' && sort==='coupon'" class="check-control"><input v-model="convertProcessingCost" type="checkbox">加工金币按 0.425 折算采集券</label>
    </section>
    <div class="module-callout"><strong>{{ type === 'research' ? '系统参考：4.35374 次 / 万金条' : `系统直购比：${type==='nano1'?'2.0':type==='nano2'?'0.64':'0.125'}` }}</strong><span>红色数值表示按旧版判定，市场直购成本低于等价采集券成本。</span></div>
    <section class="data-table nano-table">
      <div class="table-head nano-grid"><span>材料</span><span>加工成本</span><span>平均产出</span><span>券收益比</span><span>直购收益比</span></div>
      <article v-for="item in visible" :key="item.id" class="data-row nano-grid">
        <div><strong>{{ item.name }}</strong><small>Lv {{ item.level }}</small></div>
        <div><span>{{ metrics(item).coupon }} 券</span><small v-if="metrics(item).gold">＋ {{ metrics(item).gold }} 金条</small><small v-if="!metrics(item).complete" class="negative">材料售价不完整</small></div>
        <div><strong>{{ metrics(item).amount }}</strong><small v-if="type!=='research'">范围 {{ metrics(item).range?.min }}～{{ metrics(item).range?.max }}</small><small v-else>个 / 次</small></div>
        <strong :class="{negative:item.marketPrice!==null && metrics(item).coupon>0 && item.marketPrice < metrics(item).coupon*0.425}">{{ metrics(item).couponRatio || '—' }}</strong>
        <strong>{{ metrics(item).purchaseRatio || '—' }}</strong>
      </article>
      <p v-if="!visible.length" class="state-message">当前筛选条件下没有材料</p>
    </section>
  </section>
</template>
