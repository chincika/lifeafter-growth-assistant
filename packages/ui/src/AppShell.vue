<script setup lang="ts">
import { useI18n } from "vue-i18n";

const { t } = useI18n();
const navigationKeys = [
  "overview",
  "market",
  "nano",
  "cookbook",
  "progression",
  "news",
  "activities",
  "settings",
] as const;
</script>

<template>
  <div class="app-shell">
    <aside class="sidebar">
      <header class="brand">
        <span class="brand-mark" aria-hidden="true">M</span>
        <div>
          <h1>{{ t("app.title") }}</h1>
          <p>{{ t("app.subtitle") }}</p>
        </div>
      </header>

      <nav aria-label="主导航">
        <button
          v-for="(key, index) in navigationKeys"
          :key="key"
          type="button"
          :class="['nav-item', { active: index === 0 }]"
        >
          {{ t(`navigation.${key}`) }}
        </button>
      </nav>

      <p class="privacy-note">{{ t("status.offline") }}</p>
    </aside>

    <main class="workspace">
      <section class="placeholder-card">
        <span class="eyebrow">Architecture preview</span>
        <h2>{{ t("navigation.overview") }}</h2>
        <p>{{ t("status.rebuilding") }}</p>
      </section>
    </main>
  </div>
</template>
