import { startGodhandServer, waitForServer, type GodhandServerHandle } from "@godhand/server/server";
import { getDesktopPaths } from "./paths.js";

/** Fixed API port in desktop dev — must match renderer proxy in electron.vite.config.ts */
export const DESKTOP_DEV_API_PORT = 3001;

let handle: GodhandServerHandle | null = null;

export interface DesktopServerStartOptions {
  serveWebStatic?: boolean;
  port?: number;
}

export async function startDesktopServer(
  options: DesktopServerStartOptions = {}
): Promise<GodhandServerHandle> {
  if (handle) return handle;

  const paths = getDesktopPaths();
  handle = await startGodhandServer({
    dbPath: paths.dbPath,
    webDist: paths.webDist,
    migrationsFolder: paths.migrationsFolder,
    logger: !process.env.GODHAND_QUIET,
    serveWebStatic: options.serveWebStatic,
    port: options.port,
  });

  await waitForServer(handle.url);
  return handle;
}

export async function stopDesktopServer(): Promise<void> {
  if (handle) {
    await handle.stop();
    handle = null;
  }
}

export function getServerUrl(): string | null {
  return handle?.url ?? null;
}
