import { startGodhandServer, waitForServer, type GodhandServerHandle } from "@godhand/server/server";
import { getDesktopPaths } from "./paths.js";

/** Fixed API port in desktop dev — must match Vite proxy in apps/web/vite.config.ts */
export const DESKTOP_DEV_API_PORT = 3001;
export const DESKTOP_DEV_WEB_URL =
  process.env.GODHAND_WEB_DEV_URL ?? "http://127.0.0.1:3000";

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

export async function waitForWebDev(url: string, maxAttempts = 120): Promise<void> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`Vite dev server not ready at ${url}`);
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
