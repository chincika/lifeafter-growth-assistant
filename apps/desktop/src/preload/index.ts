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
  level: number;
  marketPrice: number | null;
  focused: boolean;
  hasRecipe: boolean;
  hasNano: boolean;
}

const desktopApi = Object.freeze({
  async getRuntimeInfo(): Promise<DesktopRuntimeInfo> {
    return ipcRenderer.invoke("runtime:get-info") as Promise<DesktopRuntimeInfo>;
  },
  async listMarketItems(): Promise<MarketItemSummary[]> {
    return ipcRenderer.invoke("market:list-items") as Promise<MarketItemSummary[]>;
  },
  async setMarketItemState(input: {
    id: string;
    marketPrice: number | null;
    focused: boolean;
  }): Promise<void> {
    await ipcRenderer.invoke("market:set-item-state", input);
  },
});

contextBridge.exposeInMainWorld("desktopApi", desktopApi);

export type DesktopApi = typeof desktopApi;
