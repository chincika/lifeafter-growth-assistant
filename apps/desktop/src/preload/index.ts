import { contextBridge, ipcRenderer } from "electron";

export interface DesktopRuntimeInfo {
  platform: NodeJS.Platform;
  portable: boolean;
  appVersion: string;
  databaseVersion: number;
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
}
export interface GrowthPlan { id: string; name: string; planType: string; payload: Record<string, unknown>; updatedAt: string }

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
