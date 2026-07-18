<script setup lang="ts">
import { computed, ref } from "vue";
interface News { id: string; publishedDate?: string; title: string; imageUrl: string }
const props = defineProps<{ entries: News[] }>();
const query = ref("");
const selected = ref<News | null>(null);
const visible = computed(() => props.entries.filter((entry) => !query.value.trim() || entry.title.includes(query.value.trim())).sort((a,b)=>(b.publishedDate??"").localeCompare(a.publishedDate??"")));
</script>
<template>
  <section class="module-workspace">
    <header class="page-header"><h2>幸存者快报</h2><input v-model="query" class="search-input" type="search" placeholder="按日期搜索…"></header>
    <section class="news-history"><button v-for="entry in visible" :key="entry.id" type="button" @click="selected=entry"><span>{{ entry.publishedDate }}</span><strong>{{ entry.title }}</strong><small>查看长图</small></button></section>
    <div v-if="selected" class="modal-backdrop" @click.self="selected=null"><section class="news-modal"><header><h2>{{ selected.title }}</h2><button class="close-button" type="button" @click="selected=null">×</button></header><div class="long-image-view"><img :src="selected.imageUrl" :alt="selected.title"><p>若图片无法显示，说明旧外链已经失效；历史记录本身仍保留。</p></div></section></div>
  </section>
</template>
