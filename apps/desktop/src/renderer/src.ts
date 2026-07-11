import { createApp, h, onMounted, ref } from "vue";
import { createI18n } from "vue-i18n";

import { AppShell, zhCN } from "@lifeafter-assistant/ui";

import "@lifeafter-assistant/ui/styles.css";

const i18n = createI18n({
  legacy: false,
  locale: "zh-CN",
  fallbackLocale: "zh-CN",
  messages: { "zh-CN": zhCN },
});

const Root = {
  setup() {
    const items = ref<Awaited<ReturnType<typeof window.desktopApi.listMarketItems>>>([]);
    const loading = ref(true);
    const error = ref("");
    onMounted(async () => {
      try {
        items.value = await window.desktopApi.listMarketItems();
      } catch (reason) {
        error.value = reason instanceof Error ? reason.message : String(reason);
      } finally {
        loading.value = false;
      }
    });
    async function updateItemState(input: { id: string; marketPrice: number | null; focused: boolean }) {
      await window.desktopApi.setMarketItemState(input);
      const item = items.value.find((candidate) => candidate.id === input.id);
      if (item) {
        item.marketPrice = input.marketPrice;
        item.focused = input.focused;
      }
    }
    async function updateRecipeChoice(input: { productId: string; ingredientId: string; acquisitionMode: "craft" | "purchase" }) {
      await window.desktopApi.setRecipeChoice(input);
      const product = items.value.find((item) => item.id === input.productId);
      const ingredient = product?.recipe.find((entry) => entry.ingredientId === input.ingredientId);
      if (ingredient) ingredient.acquisitionMode = input.acquisitionMode;
    }
    async function addCustomItem(input: Parameters<typeof window.desktopApi.addCustomMarketItem>[0]) {
      try {
        await window.desktopApi.addCustomMarketItem(input);
        items.value = await window.desktopApi.listMarketItems();
      } catch (reason) {
        error.value = reason instanceof Error ? reason.message : String(reason);
      }
    }
    return () => h(AppShell, {
      items: items.value,
      loading: loading.value,
      error: error.value,
      onUpdateItemState: updateItemState,
      onUpdateRecipeChoice: updateRecipeChoice,
      onAddCustomItem: addCustomItem,
    });
  },
};

createApp(Root).use(i18n).mount("#app");
