import { createApp, h, onMounted, ref } from "vue";
import { createI18n } from "vue-i18n";
import { AppShell, zhCN } from "@lifeafter-assistant/ui";
import type { AppSettings, BackupRecord, DesktopRuntimeInfo } from "../preload/index.js";
import "@lifeafter-assistant/ui/styles.css";

const i18n = createI18n({ legacy: false, locale: "zh-CN", fallbackLocale: "zh-CN", messages: { "zh-CN": zhCN } });
const defaultSettings: AppSettings = { theme: "system", clientUpdateFrequency: "weekly", contentAutoUpdate: true };
const emptyReferences = { cookbook: [], activities: { categories: [], entries: [] }, news: { enabled: false, entries: [] } };

function applyTheme(theme: AppSettings["theme"]) {
  if (theme === "system") delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = theme;
}

const Root = {
  setup() {
    const items = ref<Awaited<ReturnType<typeof window.desktopApi.listMarketItems>>>([]);
    const loading = ref(true); const error = ref(""); const busy = ref(false); const updateStatus = ref(""); const updateUrl = ref("");
    const growthContent = ref<Record<string, unknown>>({}); const growthPlans = ref<Awaited<ReturnType<typeof window.desktopApi.listGrowthPlans>>>([]);
    const referenceContent = ref<any>(emptyReferences); const settings = ref<AppSettings>(defaultSettings); const runtime = ref<DesktopRuntimeInfo | null>(null); const backups = ref<BackupRecord[]>([]);
    async function loadAll() {
      [items.value, growthContent.value, growthPlans.value, referenceContent.value, settings.value, runtime.value, backups.value] = await Promise.all([
        window.desktopApi.listMarketItems(), window.desktopApi.getGrowthContent(), window.desktopApi.listGrowthPlans(), window.desktopApi.getReferenceContent(), window.desktopApi.getSettings(), window.desktopApi.getRuntimeInfo(), window.desktopApi.listBackups(),
      ]);
      applyTheme(settings.value.theme);
    }
    onMounted(async () => {
      try { await loadAll(); const result = await window.desktopApi.checkUpdates(false); if (!result.skipped) { updateStatus.value = result.update ? (result.message ?? "发现客户端更新") : ""; updateUrl.value = result.update ? (result.downloadPageUrl ?? "") : ""; if (result.contentUpdated) [items.value,growthContent.value,referenceContent.value] = await Promise.all([window.desktopApi.listMarketItems(),window.desktopApi.getGrowthContent(),window.desktopApi.getReferenceContent()]); } }
      catch (reason) { error.value = reason instanceof Error ? reason.message : String(reason); }
      finally { loading.value = false; }
    });
    async function updateItemState(input: { id: string; marketPrice: number | null; focused: boolean }) { await window.desktopApi.setMarketItemState(input); const item=items.value.find((candidate)=>candidate.id===input.id); if(item){item.marketPrice=input.marketPrice;item.focused=input.focused;} }
    async function updateRecipeChoice(input: { productId: string; ingredientId: string; acquisitionMode: "craft" | "purchase" }) { await window.desktopApi.setRecipeChoice(input); const product=items.value.find((item)=>item.id===input.productId);const ingredient=product?.recipe.find((entry)=>entry.ingredientId===input.ingredientId);if(ingredient)ingredient.acquisitionMode=input.acquisitionMode; }
    async function addCustomItem(input: Parameters<typeof window.desktopApi.addCustomMarketItem>[0]) { try{await window.desktopApi.addCustomMarketItem(input);items.value=await window.desktopApi.listMarketItems();}catch(reason){error.value=reason instanceof Error?reason.message:String(reason);} }
    async function saveGrowthPlan(input: Parameters<typeof window.desktopApi.saveGrowthPlan>[0]) { await window.desktopApi.saveGrowthPlan(input);growthPlans.value=await window.desktopApi.listGrowthPlans(); }
    async function deleteGrowthPlan(id:string){await window.desktopApi.deleteGrowthPlan(id);growthPlans.value=await window.desktopApi.listGrowthPlans();}
    async function setCookbookUnlock(input:{id:string;unlocked:boolean}){await window.desktopApi.setCookbookUnlock(input);const recipe=referenceContent.value.cookbook.find((item:any)=>item.id===input.id);if(recipe)recipe.unlocked=input.unlocked;}
    async function saveSettings(input:AppSettings){settings.value=input;applyTheme(input.theme);await window.desktopApi.setSettings(input);}
    async function withBusy(action:()=>Promise<void>){busy.value=true;try{await action();}catch(reason){updateStatus.value=reason instanceof Error?reason.message:String(reason);}finally{busy.value=false;}}
    async function createBackup(){await withBusy(async()=>{await window.desktopApi.createBackup();backups.value=await window.desktopApi.listBackups();updateStatus.value="本地备份已创建";});}
    async function restoreBackup(){await withBusy(async()=>{const result=await window.desktopApi.restoreBackup();if(!result.canceled){await loadAll();updateStatus.value=`已恢复备份：${result.restored.fileName}`;}});}
    async function exportBackup(id:string){await withBusy(async()=>{const result=await window.desktopApi.exportBackup(id);if(!result.canceled)updateStatus.value="备份副本已导出";});}
    async function importLegacy(){await withBusy(async()=>{const result=await window.desktopApi.importLegacyData();if(!result.canceled){await loadAll();const report=result.report;updateStatus.value=`旧版数据导入完成：${report.importedPrices} 项价格、${report.importedCookbook} 条食谱状态`;}});}
    async function checkUpdates(){await withBusy(async()=>{const result=await window.desktopApi.checkUpdates(true);updateStatus.value=result.update?`发现 ${result.policy==='required'?'必须':result.policy==='recommended'?'建议':'可选'}更新 ${result.latest}：${result.message}`:result.message;updateUrl.value=result.update?(result.downloadPageUrl??""):"";if(result.contentUpdated){[items.value,growthContent.value,referenceContent.value]=await Promise.all([window.desktopApi.listMarketItems(),window.desktopApi.getGrowthContent(),window.desktopApi.getReferenceContent()]);}});}
    return()=>h(AppShell,{items:items.value,loading:loading.value,error:error.value,growthContent:growthContent.value,growthPlans:growthPlans.value,referenceContent:referenceContent.value,settings:settings.value,runtime:runtime.value,backups:backups.value,updateStatus:updateStatus.value,updateUrl:updateUrl.value,busy:busy.value,onUpdateItemState:updateItemState,onUpdateRecipeChoice:updateRecipeChoice,onAddCustomItem:addCustomItem,onSaveGrowthPlan:saveGrowthPlan,onDeleteGrowthPlan:deleteGrowthPlan,onSetCookbookUnlock:setCookbookUnlock,onSaveSettings:saveSettings,onCreateBackup:createBackup,onRestoreBackup:restoreBackup,onExportBackup:exportBackup,onImportLegacy:importLegacy,onCheckUpdates:checkUpdates,onOpenUpdatePage:()=>window.desktopApi.openUpdatePage(updateUrl.value),onOpenDataFolder:()=>window.desktopApi.openDataFolder(),onExportDiagnostics:()=>window.desktopApi.exportDiagnostics()});
  },
};
createApp(Root).use(i18n).mount("#app");
