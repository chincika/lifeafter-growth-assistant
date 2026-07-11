import { createApp } from "vue";
import { createI18n } from "vue-i18n";

import { AppShell, zhCN } from "@lifeafter-assistant/ui";

import "@lifeafter-assistant/ui/styles.css";

const i18n = createI18n({
  legacy: false,
  locale: "zh-CN",
  fallbackLocale: "zh-CN",
  messages: { "zh-CN": zhCN },
});

createApp(AppShell).use(i18n).mount("#app");
