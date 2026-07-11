import { app, BrowserWindow, dialog, ipcMain, shell } from "electron";
import { mkdirSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

import {
  migrateDatabase,
  openDatabase,
  type SqliteDatabase,
} from "@lifeafter-assistant/database";

const APP_ID = "io.github.chincika.lifeafter-growth-assistant";
const portableDirectory = process.env.PORTABLE_EXECUTABLE_DIR;
const testDataDirectory = process.env.LIFEAFTER_ASSISTANT_USER_DATA_DIR;
const dataRoot = portableDirectory
  ? join(portableDirectory, "Data")
  : (testDataDirectory ?? app.getPath("userData"));

if (portableDirectory || testDataDirectory) app.setPath("userData", dataRoot);
app.setAppUserModelId(APP_ID);
let database: SqliteDatabase | undefined;

function assertWritableDataRoot(): void {
  try {
    mkdirSync(dataRoot, { recursive: true });
    const probe = join(dataRoot, `.write-test-${randomUUID()}`);
    writeFileSync(probe, "ok", { encoding: "utf8", flag: "wx" });
    unlinkSync(probe);
  } catch (error) {
    dialog.showErrorBox(
      "数据目录不可写",
      `无法写入数据目录：\n${dataRoot}\n\n请将便携版移动到可写目录后重试。\n\n${String(error)}`,
    );
    app.exit(1);
  }
}

function isTrustedExternalUrl(rawUrl: string): boolean {
  try {
    const url = new URL(rawUrl);
    return (
      url.protocol === "https:" &&
      (url.hostname === "github.com" || url.hostname.endsWith(".github.com"))
    );
  } catch {
    return false;
  }
}

function isTrustedRendererUrl(rawUrl: string): boolean {
  try {
    const url = new URL(rawUrl);
    if (url.protocol === "file:") return true;
    return (
      process.env.ELECTRON_RENDERER_URL !== undefined &&
      url.origin === new URL(process.env.ELECTRON_RENDERER_URL).origin
    );
  } catch {
    return false;
  }
}

function registerIpcHandlers(databaseVersion: number): void {
  ipcMain.handle("runtime:get-info", (event) => {
    if (!isTrustedRendererUrl(event.senderFrame?.url ?? "")) {
      throw new Error("Rejected IPC request from an untrusted renderer");
    }
    return {
      platform: process.platform,
      portable: Boolean(portableDirectory),
      appVersion: app.getVersion(),
      databaseVersion,
    };
  });
}

function createWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1240,
    height: 820,
    minWidth: 960,
    minHeight: 640,
    show: false,
    title: "明日之后养成助手",
    backgroundColor: "#111827",
    webPreferences: {
      preload: join(import.meta.dirname, "../preload/index.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  window.once("ready-to-show", () => window.show());

  window.webContents.setWindowOpenHandler(({ url }) => {
    if (isTrustedExternalUrl(url)) void shell.openExternal(url);
    return { action: "deny" };
  });

  window.webContents.on("will-navigate", (event, url) => {
    const currentUrl = window.webContents.getURL();
    if (url !== currentUrl) event.preventDefault();
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    void window.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    void window.loadFile(join(import.meta.dirname, "../renderer/index.html"));
  }

  return window;
}

app.whenReady().then(() => {
  assertWritableDataRoot();
  database = openDatabase(join(dataRoot, "assistant.sqlite"));
  const databaseVersion = migrateDatabase(database);
  registerIpcHandlers(databaseVersion);
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  database?.close();
  database = undefined;
});
