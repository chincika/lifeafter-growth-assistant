import { contextBridge } from "electron";

export interface DesktopRuntimeInfo {
  platform: NodeJS.Platform;
  portable: boolean;
}

const desktopApi = Object.freeze({
  getRuntimeInfo(): DesktopRuntimeInfo {
    return {
      platform: process.platform,
      portable: Boolean(process.env.PORTABLE_EXECUTABLE_DIR),
    };
  },
});

contextBridge.exposeInMainWorld("desktopApi", desktopApi);

export type DesktopApi = typeof desktopApi;
