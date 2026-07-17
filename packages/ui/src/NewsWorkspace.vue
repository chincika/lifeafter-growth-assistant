<script setup lang="ts">
import { computed, ref } from "vue";
interface News { id: string; publishedDate?: string; title: string; imageUrl: string }
const props = defineProps<{ enabled: boolean; entries: News[] }>();
const query = ref("");
const selected = ref<News | null>(null);
const visible = computed(() => props.entries.filter((entry) => !query.value.trim() || entry.title.includes(query.value.trim())));
</script>
<template>
  <section class="module-workspace">
    <header class="page-header"><div><span class="eyebrow">历史资料已保留</span><h2>幸存者快报</h2><p>快报发布通道目前按你的决定保持关闭；旧版历史索引仍可查阅，不会影响其他功能。</p></div><input v-model="query" class="search-input" type="search" placeholder="按日期搜索…"></header>
    <div class="module-callout warning-callout"><strong>{{ enabled ? '发布通道已启用' : '发布通道暂时关闭' }}</strong><span>历史长图来自原归档中的外部地址，预览需要联网；新客户端不会自动上传任何数据。</span></div>
    <section class="news-history"><button v-for="entry in visible" :key="entry.id" type="button" @click="selected=entry"><span>{{ entry.publishedDate }}</span><strong>{{ entry.title }}</strong><small>查看长图</small></button></section>
    <div v-if="selected" class="modal-backdrop" @click.self="selected=null"><section class="news-modal"><header><div><span class="eyebrow">历史快报</span><h2>{{ selected.title }}</h2></div><button class="close-button" type="button" @click="selected=null">×</button></header><div class="long-image-view"><img :src="selected.imageUrl" :alt="selected.title"><p>若图片无法显示，说明旧外链已经失效；历史记录本身仍保留。</p></div></section></div>
  </section>
</template>
