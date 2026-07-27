import type { DesktopApi } from "../preload/index.js";

declare global {
  interface Window {
    desktopApi: DesktopApi;
  }
}

export {};
