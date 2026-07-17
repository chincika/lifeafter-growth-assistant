<script setup lang="ts">
import { computed } from "vue";
const props = defineProps<{ items: Array<{ marketPrice: number | null; focused: boolean; hasNano: boolean }>; recipes: Array<{ unlocked: boolean }>; plans: unknown[]; backups: unknown[] }>();
const priced = computed(() => props.items.filter((item) => item.marketPrice !== null).length);
const focused = computed(() => props.items.filter((item) => item.focused).length);
const nano = computed(() => props.items.filter((item) => item.hasNano).length);
const unlocked = computed(() => props.recipes.filter((item) => item.unlocked).length);
</script>
<template><section class="module-workspace overview-workspace"><header class="page-header"><div><span class="eyebrow">本地数据总览</span><h2>今天想计算什么？</h2><p>所有个人数据都只保存在当前电脑；公共资料更新不会覆盖售价、解锁状态或方案。</p></div></header><section class="overview-grid"><article><span>地摊资料</span><strong>{{ items.length }}</strong><small>{{ priced }} 项已填售价 · {{ focused }} 项关注</small></article><article><span>纳米材料</span><strong>{{ nano }}</strong><small>直接使用地摊价格计算</small></article><article><span>食谱进度</span><strong>{{ unlocked }} / {{ recipes.length }}</strong><small>解锁状态实时保存</small></article><article><span>养成方案</span><strong>{{ plans.length }}</strong><small>包含已保存的图谱方案</small></article><article><span>本地备份</span><strong>{{ backups.length }}</strong><small>每日首次启动自动备份</small></article></section><div class="module-callout"><strong>离线优先</strong><span>地摊、纳米、食谱和养成计算均不依赖旧网站；仅检查更新与历史快报预览需要联网。</span></div></section></template>
