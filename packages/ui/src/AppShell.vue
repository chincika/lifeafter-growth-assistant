<script setup lang="ts">
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";

export interface MarketItemSummary {
  id: string;
  name: string;
  category: string;
  level: number;
  marketPrice: number | null;
  focused: boolean;
  hasRecipe: boolean;
  hasNano: boolean;
}

const props = defineProps<{
  items: MarketItemSummary[];
  loading: boolean;
  error: string;
}>();
const emit = defineEmits<{
  updateItemState: [input: { id: string; marketPrice: number | null; focused: boolean }];
}>();
const { t } = useI18n();
const active = ref("market");
const query = ref("");
const navigationKeys = ["overview", "market", "nano", "cookbook", "progression", "news", "activities", "settings"] as const;
const visibleItems = computed(() => {
  const keyword = query.value.trim().toLocaleLowerCase("zh-CN");
  return keyword
    ? props.items.filter((item) => item.name.toLocaleLowerCase("zh-CN").includes(keyword))
    : props.items;
});
const recipeCount = computed(() => props.items.filter((item) => item.hasRecipe).length);
const nanoCount = computed(() => props.items.filter((item) => item.hasNano).length);
function setPrice(item: MarketItemSummary, event: Event) {
  const raw = (event.target as HTMLInputElement).value.trim();
  const marketPrice = raw === "" ? null : Number(raw);
  if (marketPrice === null || (Number.isInteger(marketPrice) && marketPrice >= 0)) {
    emit("updateItemState", { id: item.id, marketPrice, focused: item.focused });
  }
}
function toggleFocus(item: MarketItemSummary) {
  emit("updateItemState", { id: item.id, marketPrice: item.marketPrice, focused: !item.focused });
}
</script>

<template>
  <div class="app-shell">
    <aside class="sidebar">
      <header class="brand">
        <span class="brand-mark" aria-hidden="true">M</span>
        <div><h1>{{ t("app.title") }}</h1><p>{{ t("app.subtitle") }}</p></div>
      </header>
      <nav aria-label="主导航">
        <button v-for="key in navigationKeys" :key="key" type="button"
          :class="['nav-item', { active: active === key }]" @click="active = key">
          {{ t(`navigation.${key}`) }}
        </button>
      </nav>
      <p class="privacy-note">{{ t("status.offline") }}</p>
    </aside>

    <main class="workspace">
      <template v-if="active === 'market'">
        <header class="page-header">
          <div><span class="eyebrow">本地基础资料</span><h2>地摊物品</h2><p>公共资料与个人价格分开保存，更新资料不会覆盖你的数据。</p></div>
          <label class="search"><span class="sr-only">搜索物品</span><input v-model="query" type="search" placeholder="搜索物品名称…" /></label>
        </header>
        <section class="stats" aria-label="资料统计">
          <article><strong>{{ items.length }}</strong><span>物品</span></article>
          <article><strong>{{ recipeCount }}</strong><span>含配方</span></article>
          <article><strong>{{ nanoCount }}</strong><span>纳米资料</span></article>
        </section>
        <p v-if="loading" class="state-message">正在读取本地资料…</p>
        <p v-else-if="error" class="state-message error">资料读取失败：{{ error }}</p>
        <section v-else class="item-panel">
          <div class="table-head"><span>物品</span><span>等级</span><span>资料</span><span>我的售价</span></div>
          <div class="item-list">
            <article v-for="item in visibleItems" :key="item.id" class="item-row">
              <div class="item-name"><button type="button" class="focus-button" :class="{ selected: item.focused }" :aria-label="item.focused ? `取消关注${item.name}` : `关注${item.name}`" @click="toggleFocus(item)">★</button><span><strong>{{ item.name }}</strong><small>{{ item.category }}</small></span></div>
              <span>{{ item.level }}</span>
              <span class="badges"><i v-if="item.hasRecipe">配方</i><i v-if="item.hasNano">纳米</i></span>
              <input class="price-input" type="number" min="0" step="1" :value="item.marketPrice ?? ''" placeholder="未设置" :aria-label="`${item.name}售价`" @change="setPrice(item, $event)" />
            </article>
          </div>
          <p v-if="visibleItems.length === 0" class="state-message">没有匹配“{{ query }}”的物品</p>
        </section>
      </template>
      <section v-else class="placeholder-card">
        <span class="eyebrow">模块重构中</span><h2>{{ t(`navigation.${active}`) }}</h2><p>该模块将在后续里程碑接入，地摊资料模块已经使用真实本地数据。</p>
      </section>
    </main>
  </div>
</template>
