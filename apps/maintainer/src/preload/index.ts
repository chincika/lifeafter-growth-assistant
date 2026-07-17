import { contextBridge, ipcRenderer } from "electron";
const maintainerApi = Object.freeze({
  chooseDirectory: () => ipcRenderer.invoke("content:choose-directory") as Promise<string | null>,
  chooseNewsImage: () => ipcRenderer.invoke("content:choose-news-image") as Promise<{ imageFile: string; width: number; height: number; sizeBytes: number } | null>,
  load: (directory?: string) => ipcRenderer.invoke("content:load", directory) as Promise<any>,
  saveRecord: (input: any) => ipcRenderer.invoke("content:save-record", input) as Promise<any>,
  deleteRecord: (input: any) => ipcRenderer.invoke("content:delete-record", input) as Promise<any>,
  getStoredToken: () => ipcRenderer.invoke("credentials:get-token") as Promise<string>,
  clearStoredToken: () => ipcRenderer.invoke("credentials:clear-token") as Promise<void>,
  buildRelease: (input: any) => ipcRenderer.invoke("release:build", input) as Promise<any>,
  publishRelease: (input: any) => ipcRenderer.invoke("release:publish", input) as Promise<any>,
});
contextBridge.exposeInMainWorld("maintainerApi", maintainerApi);
export type MaintainerApi = typeof maintainerApi;
