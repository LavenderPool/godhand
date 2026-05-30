import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("godhand", {
  isDesktop: true,
  browseFolder: (): Promise<string | null> => ipcRenderer.invoke("browse-folder"),
});
