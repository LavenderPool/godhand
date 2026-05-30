import {
  app,
  BrowserWindow,
  Tray,
  Menu,
  ipcMain,
  dialog,
} from "electron";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { existsSync } from "fs";
import {
  startDesktopServer,
  stopDesktopServer,
  getServerUrl,
  DESKTOP_DEV_API_PORT,
} from "./server.js";
import { loadAppIcon } from "./paths.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

function getPreloadPath(): string {
  const mjs = join(__dirname, "../preload/index.mjs");
  const js = join(__dirname, "../preload/index.js");
  if (existsSync(mjs)) return mjs;
  if (existsSync(js)) return js;
  return mjs;
}

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;

const useViteDevServer =
  !app.isPackaged && Boolean(process.env.ELECTRON_RENDERER_URL);

function toggleDevTools() {
  if (!mainWindow) return;

  if (mainWindow.webContents.isDevToolsOpened()) {
    mainWindow.webContents.closeDevTools();
    return;
  }

  mainWindow.webContents.openDevTools({ mode: "detach" });
}

function getWindowUrl(serverUrl: string): string {
  if (useViteDevServer) {
    return process.env.ELECTRON_RENDERER_URL!;
  }
  return serverUrl;
}

function createWindow(url: string) {
  const icon = loadAppIcon();

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    icon: icon.isEmpty() ? undefined : icon,
    webPreferences: {
      preload: getPreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.once("ready-to-show", () => mainWindow?.show());
  mainWindow.loadURL(url);
  mainWindow.webContents.on("before-input-event", (event, input) => {
    const isToggleShortcut =
      input.type === "keyDown" &&
      (input.key === "F12" || ((input.control || input.meta) && input.shift && input.key.toUpperCase() === "I"));

    if (!isToggleShortcut) return;

    event.preventDefault();
    toggleDevTools();
  });

  mainWindow.on("close", (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });
}

function createTray() {
  const icon = loadAppIcon();
  tray = new Tray(icon);
  tray.setToolTip("GodHand");

  tray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: "Открыть",
        click: () => {
          mainWindow?.show();
          mainWindow?.focus();
        },
      },
      {
        label: "Консоль разработчика",
        click: () => {
          mainWindow?.show();
          mainWindow?.focus();
          toggleDevTools();
        },
      },
      {
        label: "Выход",
        click: () => {
          isQuitting = true;
          app.quit();
        },
      },
    ])
  );

  tray.on("double-click", () => {
    mainWindow?.show();
    mainWindow?.focus();
  });
}

function setupIpc() {
  ipcMain.handle("browse-folder", async () => {
    const win = mainWindow ?? undefined;
    const result = await dialog.showOpenDialog(win, { properties: ["openDirectory"] });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  });

  app.whenReady().then(async () => {
    setupIpc();
    try {
      const server = await startDesktopServer({
        serveWebStatic: !useViteDevServer,
        port: useViteDevServer ? DESKTOP_DEV_API_PORT : undefined,
      });
      createWindow(getWindowUrl(server.url));
      createTray();
    } catch (err) {
      console.error("Failed to start GodHand:", err);
      app.exit(1);
    }
  });

  app.on("before-quit", async () => {
    isQuitting = true;
    await stopDesktopServer();
  });

  app.on("activate", () => {
    if (mainWindow) {
      mainWindow.show();
    } else {
      const serverUrl = getServerUrl();
      if (serverUrl) createWindow(getWindowUrl(serverUrl));
    }
  });
}
