import { contextBridge, ipcRenderer } from "electron";

export interface DesktopRuntimeInfo {
  platform: NodeJS.Platform;
  portable: boolean;
  appVersion: string;
  databaseVersion: number;
}

const desktopApi = Object.freeze({
  async getRuntimeInfo(): Promise<DesktopRuntimeInfo> {
    return ipcRenderer.invoke("runtime:get-info") as Promise<DesktopRuntimeInfo>;
  },
});

contextBridge.exposeInMainWorld("desktopApi", desktopApi);

export type DesktopApi = typeof desktopApi;
