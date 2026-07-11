<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import { useI18n } from "vue-i18n";

export interface MarketItemSummary {
  id: string; name: string; category: string; resourceType: number; level: number;
  couponCost: number; marketPrice: number | null; focused: boolean; hasRecipe: boolean; hasNano: boolean;
  recipe: Array<{ ingredientId: string; quantity: number; acquisitionMode: "craft" | "purchase" }>;
}
const props = defineProps<{ items: MarketItemSummary[]; loading: boolean; error: string }>();
const emit = defineEmits<{
  updateItemState: [input: { id: string; marketPrice: number | null; focused: boolean }];
  updateRecipeChoice: [input: { productId: string; ingredientId: string; acquisitionMode: "craft" | "purchase" }];
  addCustomItem: [input: { name: string; resourceType: number; level: number; marketPrice: number | null; couponCost: number; ingredients: Array<{ ingredientId: string; quantity: number; acquisitionMode: "craft" | "purchase" }> }];
}>();
const { t } = useI18n();
const active = ref("market");
const query = ref("");
const category = ref(-1);
const level = ref(-1);
const taxRate = ref(0.15);
const productionBonus = ref(0);
const expandedId = ref<string | null>(null);
const showAddProduct = ref(false);
const addError = ref("");
const custom = reactive({ name: "", resourceType: 5, level: 1, marketPrice: null as number | null, couponCost: 0, ingredients: [] as Array<{ ingredientId: string; quantity: number; acquisitionMode: "craft" | "purchase" }> });
const navigationKeys = ["overview", "market", "nano", "cookbook", "progression", "news", "activities", "settings"] as const;
const categoryNames = ["木", "石", "麻", "兽", "特殊材料", "半成品", "护甲", "护盾", "帽子", "刀", "弓箭", "霰弹枪", "冲锋枪", "突击步枪", "狙击枪", "榴弹炮", "喷火器", "手枪", "盾牌", "电磁机枪", "无人机", "消耗品"];
const index = computed(() => new Map(props.items.map((item) => [item.id, item])));
const visibleItems = computed(() => {
  const keyword = query.value.trim().toLocaleLowerCase("zh-CN");
  return props.items.filter((item) =>
    (category.value < 0 || item.resourceType === category.value) &&
    (level.value < 0 || item.level === level.value) &&
    (!keyword || item.name.toLocaleLowerCase("zh-CN").includes(keyword)),
  ).sort((a, b) => Number(b.focused) - Number(a.focused));
});
const levels = computed(() => [...new Set(props.items.filter((item) => category.value < 0 || item.resourceType === category.value).map((item) => item.level))].sort((a, b) => a - b));
function calculate(item: MarketItemSummary, path: string[] = []): { coupon: number; gold: number; complete: boolean } {
  if (item.resourceType <= 4) return { coupon: item.couponCost, gold: 0, complete: true };
  if (path.includes(item.id)) return { coupon: 0, gold: 0, complete: false };
  let coupon = 0, gold = 0, complete = true;
  for (const ingredient of item.recipe) {
    const child = index.value.get(ingredient.ingredientId);
    if (!child) { complete = false; continue; }
    if (ingredient.acquisitionMode === "craft") {
      const cost = calculate(child, [...path, item.id]);
      coupon += cost.coupon * ingredient.quantity;
      gold += cost.gold * ingredient.quantity;
      complete &&= cost.complete;
    } else if (child.marketPrice === null) complete = false;
    else gold += child.marketPrice * ingredient.quantity;
  }
  return { coupon, gold, complete };
}
function result(item: MarketItemSummary) {
  const cost = calculate(item);
  if (item.marketPrice === null || !cost.complete) return { ...cost, afterTax: null, profit: null, couponYield: null, bonusProfit: null };
  const afterTax = Number((item.marketPrice * (1 - taxRate.value)).toFixed(0));
  const profit = afterTax - cost.gold;
  const couponYield = item.marketPrice === 0 || cost.coupon === 0 ? 0 : Number((profit / cost.coupon * 100).toFixed(2));
  const bonusProfit = item.resourceType === 5 && productionBonus.value >= 1
    ? Number((item.marketPrice * (1 - taxRate.value) * (100 + productionBonus.value) / 100 - cost.gold).toFixed(2)) : null;
  return { ...cost, afterTax, profit, couponYield, bonusProfit };
}
function setPrice(item: MarketItemSummary, event: Event) {
  const raw = (event.target as HTMLInputElement).value.trim();
  const marketPrice = raw === "" ? null : Number(raw);
  if (marketPrice === null || (Number.isInteger(marketPrice) && marketPrice >= 0)) emit("updateItemState", { id: item.id, marketPrice, focused: item.focused });
}
function toggleFocus(item: MarketItemSummary) { emit("updateItemState", { id: item.id, marketPrice: item.marketPrice, focused: !item.focused }); }
function setAcquisitionMode(productId: string, ingredientId: string, event: Event) {
  emit("updateRecipeChoice", { productId, ingredientId, acquisitionMode: (event.target as HTMLSelectElement).value as "craft" | "purchase" });
}
function addIngredient() { custom.ingredients.push({ ingredientId: props.items[0]?.id ?? "", quantity: 1, acquisitionMode: "craft" }); }
function submitCustom() {
  addError.value = "";
  if (!custom.name.trim()) { addError.value = "请填写产品名称"; return; }
  if (custom.ingredients.some((item) => !item.ingredientId || item.quantity <= 0)) { addError.value = "请完整填写材料和数量"; return; }
  emit("addCustomItem", { name: custom.name, resourceType: custom.resourceType, level: custom.level, marketPrice: custom.marketPrice, couponCost: custom.couponCost, ingredients: custom.ingredients.map((item) => ({ ...item })) });
  showAddProduct.value = false;
  Object.assign(custom, { name: "", resourceType: 5, level: 1, marketPrice: null, couponCost: 0, ingredients: [] });
}
</script>

<template>
  <div class="app-shell">
    <aside class="sidebar"><header class="brand"><span class="brand-mark">M</span><div><h1>{{ t("app.title") }}</h1><p>{{ t("app.subtitle") }}</p></div></header>
      <nav aria-label="主导航"><button v-for="key in navigationKeys" :key="key" type="button" :class="['nav-item',{active:active===key}]" @click="active=key">{{ t(`navigation.${key}`) }}</button></nav>
      <p class="privacy-note">{{ t("status.offline") }}</p></aside>
    <main class="workspace">
      <template v-if="active==='market'">
        <header class="page-header"><div><span class="eyebrow">地摊收益计算</span><h2>物品与材料成本</h2><p>按照原版资源类型与等级排序；关注项目优先显示。</p></div><div class="header-actions"><input v-model="query" class="search-input" type="search" placeholder="搜索物品…"><button type="button" class="primary-button" @click="showAddProduct=true">＋ 添加产品</button></div></header>
        <section class="controls">
          <label>分类<select v-model.number="category" @change="level=-1"><option :value="-1">全部分类</option><option v-for="(name,i) in categoryNames" :key="name" :value="i">{{ name }}</option></select></label>
          <label>等级<select v-model.number="level"><option :value="-1">全部等级</option><option v-for="value in levels" :key="value" :value="value">Lv {{ value }}</option></select></label>
          <label>交易税率<select v-model.number="taxRate"><option :value="0.1">10%（VIP交易之城）</option><option :value="0.13">13%（VIP电视）</option><option :value="0.15">15%（交易市场）</option></select></label>
          <label>半成品额外产出<input v-model.number="productionBonus" type="number" min="0" max="10000" step="1"><span>%</span></label>
          <strong>{{ visibleItems.length }} 项</strong>
        </section>
        <p v-if="loading" class="state-message">正在读取本地资料…</p><p v-else-if="error" class="state-message error">资料读取失败：{{ error }}</p>
        <section v-else class="item-panel wide">
          <div class="table-head market-grid"><span>物品</span><span>售价</span><span>税后</span><span>金币成本</span><span>采集券</span><span>净收益</span><span>券收益率</span></div>
          <div class="item-list"><template v-for="item in visibleItems" :key="item.id"><article class="item-row market-grid">
            <div class="item-name"><button type="button" class="focus-button" :class="{selected:item.focused}" @click="toggleFocus(item)">★</button><button type="button" class="item-title" @click="expandedId=expandedId===item.id?null:item.id"><strong>{{ item.name }}</strong><small>{{ categoryNames[item.resourceType] }} · Lv {{ item.level }}<template v-if="item.hasRecipe"> · {{ expandedId===item.id?'收起':'查看配方' }}</template></small></button></div>
            <input class="price-input" type="number" min="0" step="1" :value="item.marketPrice??''" placeholder="输入售价" @change="setPrice(item,$event)">
            <span>{{ result(item).afterTax ?? '—' }}</span><span :class="{warning:!result(item).complete}">{{ result(item).complete ? result(item).gold : '待补材料价' }}</span>
            <span>{{ result(item).coupon }}</span><strong :class="{positive:(result(item).profit??0)>0,negative:(result(item).profit??0)<0}">{{ result(item).profit ?? '—' }}<small v-if="result(item).bonusProfit!==null">爆率 {{ result(item).bonusProfit }}</small></strong>
            <span>{{ result(item).couponYield===null ? '—' : `${result(item).couponYield}%` }}</span>
          </article><section v-if="expandedId===item.id && item.recipe.length" class="recipe-panel"><header><strong>{{ item.name }}的直接材料</strong><span>“制作”会继续展开配方；“购买”使用该材料的个人售价计入金币成本。</span></header><div class="recipe-list"><article v-for="ingredient in item.recipe" :key="ingredient.ingredientId"><div><strong>{{ index.get(ingredient.ingredientId)?.name }}</strong><small>× {{ ingredient.quantity }}</small></div><select :value="ingredient.acquisitionMode" @change="setAcquisitionMode(item.id,ingredient.ingredientId,$event)"><option value="craft">制作 / 兑换</option><option value="purchase">直接购买</option></select><input class="price-input" type="number" min="0" step="1" :value="index.get(ingredient.ingredientId)?.marketPrice??''" placeholder="材料售价" @change="index.get(ingredient.ingredientId)&&setPrice(index.get(ingredient.ingredientId)!,$event)"></article></div></section></template></div><p v-if="!visibleItems.length" class="state-message">没有匹配结果</p>
        </section>
      </template>
      <section v-else class="placeholder-card"><span class="eyebrow">模块重构中</span><h2>{{ t(`navigation.${active}`) }}</h2><p>该模块将在后续里程碑接入。</p></section>
    </main>
    <div v-if="showAddProduct" class="modal-backdrop" @click.self="showAddProduct=false"><form class="product-modal" @submit.prevent="submitCustom"><header><div><span class="eyebrow">本地自定义资料</span><h2>添加产品</h2></div><button type="button" class="close-button" @click="showAddProduct=false">×</button></header><div class="form-grid"><label>产品名称<input v-model.trim="custom.name" maxlength="200" required placeholder="例如：自定义半成品"></label><label>分类<select v-model.number="custom.resourceType"><option v-for="(name,i) in categoryNames" :key="name" :value="i">{{ name }}</option></select></label><label>等级<input v-model.number="custom.level" type="number" min="0" max="1000" required></label><label>我的售价<input v-model.number="custom.marketPrice" type="number" min="0" step="1" placeholder="可暂不填写"></label><label>采集券成本<input v-model.number="custom.couponCost" type="number" min="0" step="1" required></label></div><section class="material-editor"><header><strong>配方材料</strong><button type="button" @click="addIngredient">＋ 添加材料</button></header><p v-if="!custom.ingredients.length">没有配方材料时，将按原材料计算。</p><article v-for="(ingredient,i) in custom.ingredients" :key="i"><select v-model="ingredient.ingredientId"><option v-for="item in items" :key="item.id" :value="item.id">{{ item.name }} · Lv {{ item.level }}</option></select><input v-model.number="ingredient.quantity" type="number" min="0.000001" step="any" aria-label="材料数量"><select v-model="ingredient.acquisitionMode"><option value="craft">制作 / 兑换</option><option value="purchase">直接购买</option></select><button type="button" class="remove-button" @click="custom.ingredients.splice(i,1)">删除</button></article></section><p v-if="addError" class="form-error">{{ addError }}</p><footer><button type="button" class="secondary-button" @click="showAddProduct=false">取消</button><button type="submit" class="primary-button">保存产品</button></footer></form></div>
  </div>
</template>
