import { contextBridge, ipcRenderer } from "electron";

export interface DesktopRuntimeInfo {
  platform: NodeJS.Platform;
  portable: boolean;
  appVersion: string;
  databaseVersion: number;
  dataRoot: string;
}

export interface MarketItemSummary {
  id: string;
  name: string;
  category: string;
  resourceType: number;
  level: number;
  couponCost: number;
  recipe: Array<{
    ingredientId: string;
    quantity: number;
    acquisitionMode: "craft" | "purchase";
  }>;
  marketPrice: number | null;
  focused: boolean;
  hasRecipe: boolean;
  hasNano: boolean;
  nano: { nano1: { min: number; max: number; average: number }; nano2: { min: number; max: number; average: number }; nano3: { min: number; max: number; average: number } } | null;
}
export interface GrowthPlan { id: string; name: string; planType: string; payload: Record<string, unknown>; updatedAt: string }
export interface AppSettings { theme: "system" | "dark" | "light"; clientUpdateFrequency: "launch" | "daily" | "weekly" | "monthly" | "never"; contentAutoUpdate: boolean }
export interface BackupRecord { id: string; backupType: string; fileName: string; sha256: string; sizeBytes: number; createdAt: string; status: string }

const desktopApi = Object.freeze({
  async getRuntimeInfo(): Promise<DesktopRuntimeInfo> {
    return ipcRenderer.invoke("runtime:get-info") as Promise<DesktopRuntimeInfo>;
  },
  async listMarketItems(): Promise<MarketItemSummary[]> {
    return ipcRenderer.invoke("market:list-items") as Promise<MarketItemSummary[]>;
  },
  async getGrowthContent(): Promise<Record<string, unknown>> {
    return ipcRenderer.invoke("growth:get-content") as Promise<Record<string, unknown>>;
  },
  async getReferenceContent(): Promise<any> { return ipcRenderer.invoke("reference:get-content"); },
  async setCookbookUnlock(input: { id: string; unlocked: boolean }): Promise<void> { await ipcRenderer.invoke("cookbook:set-unlock", input); },
  async getSettings(): Promise<AppSettings> { return ipcRenderer.invoke("settings:get") as Promise<AppSettings>; },
  async setSettings(input: AppSettings): Promise<AppSettings> { return ipcRenderer.invoke("settings:set", input) as Promise<AppSettings>; },
  async listBackups(): Promise<BackupRecord[]> { return ipcRenderer.invoke("backups:list") as Promise<BackupRecord[]>; },
  async createBackup(): Promise<BackupRecord> { return ipcRenderer.invoke("backups:create") as Promise<BackupRecord>; },
  async exportBackup(id: string): Promise<{ canceled: boolean }> { return ipcRenderer.invoke("backups:export", id) as Promise<{ canceled: boolean }>; },
  async restoreBackup(): Promise<any> { return ipcRenderer.invoke("backups:restore"); },
  async importLegacyData(): Promise<any> { return ipcRenderer.invoke("migration:import-legacy"); },
  async openDataFolder(): Promise<void> { await ipcRenderer.invoke("runtime:open-data-folder"); },
  async exportDiagnostics(): Promise<{ canceled: boolean }> { return ipcRenderer.invoke("runtime:export-diagnostics") as Promise<{ canceled: boolean }>; },
  async checkUpdates(force = false): Promise<any> { return ipcRenderer.invoke("updates:check", force); },
  async openUpdatePage(url: string): Promise<void> { await ipcRenderer.invoke("updates:open-download", url); },
  async listGrowthPlans(): Promise<GrowthPlan[]> { return ipcRenderer.invoke("growth:list-plans") as Promise<GrowthPlan[]>; },
  async saveGrowthPlan(input: { id?: string; name: string; module: string; payload: Record<string, unknown> }): Promise<string> { return ipcRenderer.invoke("growth:save-plan", input) as Promise<string>; },
  async deleteGrowthPlan(id: string): Promise<void> { await ipcRenderer.invoke("growth:delete-plan", id); },
  async setMarketItemState(input: {
    id: string;
    marketPrice: number | null;
    focused: boolean;
  }): Promise<void> {
    await ipcRenderer.invoke("market:set-item-state", input);
  },
  async setRecipeChoice(input: { productId: string; ingredientId: string; acquisitionMode: "craft" | "purchase" }): Promise<void> {
    await ipcRenderer.invoke("market:set-recipe-choice", input);
  },
  async addCustomMarketItem(input: {
    name: string; resourceType: number; level: number; marketPrice: number | null; couponCost: number;
    ingredients: Array<{ ingredientId: string; quantity: number; acquisitionMode: "craft" | "purchase" }>;
  }): Promise<string> {
    return ipcRenderer.invoke("market:add-custom-item", input) as Promise<string>;
  },
});

contextBridge.exposeInMainWorld("desktopApi", desktopApi);

export type DesktopApi = typeof desktopApi;
