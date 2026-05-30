import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import fastifyStatic from "@fastify/static";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { existsSync } from "fs";
import { createServer } from "net";
import type { Db } from "@godhand/db";
import { getBackupsDir, runMigrations } from "@godhand/db";
import { registerRoutes } from "./routes.js";
import { initMcpRelay, stopMcp } from "./services/mcp.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const defaultMigrationsFolder = resolve(__dirname, "../../../packages/db/drizzle");
const defaultWebDist = resolve(__dirname, "../../web/dist");

export interface GodhandServerOptions {
  port?: number;
  dbPath?: string;
  webDist?: string;
  migrationsFolder?: string;
  logger?: boolean;
  /** When false, API-only mode (no static web bundle). Used with Vite dev server. */
  serveWebStatic?: boolean;
}

export interface GodhandServerHandle {
  app: FastifyInstance;
  db: Db;
  port: number;
  url: string;
  stop: () => Promise<void>;
}

function findFreePort(): Promise<number> {
  return new Promise((resolvePort, reject) => {
    const server = createServer();
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      if (!addr || typeof addr === "string") {
        server.close();
        reject(new Error("Could not find free port"));
        return;
      }
      const port = addr.port;
      server.close((err) => (err ? reject(err) : resolvePort(port)));
    });
    server.on("error", reject);
  });
}

export async function startGodhandServer(
  options: GodhandServerOptions = {}
): Promise<GodhandServerHandle> {
  const port = options.port ?? (await findFreePort());
  const dbPath = resolve(options.dbPath ?? process.env.DB_PATH ?? "./data/godhand.db");
  const migrationsFolder = options.migrationsFolder ?? defaultMigrationsFolder;
  const webDist = options.webDist ?? defaultWebDist;

  const { db } = await runMigrations(dbPath, migrationsFolder);
  const backupsDir = getBackupsDir(dbPath);

  const app = Fastify({ logger: options.logger ?? true });
  app.log.info({ dbPath, backupsDir }, "Database ready");

  await app.register(cors, { origin: true, credentials: true });

  app.addHook("onSend", async (_req, reply) => {
    reply.header("X-Frame-Options", "ALLOWALL");
    reply.header("Content-Security-Policy", "frame-ancestors *");
  });

  await registerRoutes(app, db);

  const serveWebStatic = options.serveWebStatic !== false;
  if (serveWebStatic && existsSync(webDist)) {
    await app.register(fastifyStatic, { root: webDist, prefix: "/" });
    app.setNotFoundHandler((req, reply) => {
      if (req.url.startsWith("/api/")) {
        reply.status(404).send({ error: "Not found" });
      } else {
        reply.sendFile("index.html");
      }
    });
  }

  initMcpRelay();
  await app.listen({ port, host: "127.0.0.1" });

  const url = `http://127.0.0.1:${port}`;
  return {
    app,
    db,
    port,
    url,
    stop: async () => {
      stopMcp();
      await app.close();
    },
  };
}

export async function waitForServer(url: string, maxAttempts = 30): Promise<void> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const res = await fetch(`${url}/api/v1/status`);
      if (res.ok) return;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`Server not ready at ${url}`);
}
