import {
  McpGodotServer,
  detectGodotExecutable,
  sharedWsRelay,
  buildProjectWsUrl,
  getPluginVersion,
} from "@godhand/mcp-godot/lib";
import { WS_BASE_PORT } from "@godhand/shared";
import { emitEvent } from "../events.js";
import { eq } from "drizzle-orm";
import type { Db } from "@godhand/db";
import { appSettings, mcpConnections, projects } from "@godhand/db";

const instances = new Map<string, McpGodotServer>();
let relayStarted = false;
let dbRef: Db | null = null;

function getSetting(key: string): string | undefined {
  if (!dbRef) return undefined;
  return dbRef.select().from(appSettings).where(eq(appSettings.key, key)).get()?.value;
}

function getGodotPathSetting(): string | undefined {
  const value = getSetting("godotPath") || process.env.GODOT_PATH || undefined;
  return value?.trim() || undefined;
}

function getProjectPath(projectId: string): string | undefined {
  if (!dbRef) return undefined;
  const project = dbRef.select().from(projects).where(eq(projects.id, projectId)).get();
  return project?.path?.trim() || undefined;
}

function saveGodotPathSetting(path: string): void {
  if (!dbRef) return;
  const existing = dbRef.select().from(appSettings).where(eq(appSettings.key, "godotPath")).get();
  if (existing) {
    dbRef.update(appSettings).set({ value: path }).where(eq(appSettings.key, "godotPath")).run();
  } else {
    dbRef.insert(appSettings).values({ key: "godotPath", value: path }).run();
  }
}

export async function resolveGodotPath(persist = true): Promise<string | undefined> {
  return (await resolveGodotPathInfo(persist)).path;
}

export async function resolveGodotPathInfo(
  persist = true
): Promise<{ path?: string; source: "settings" | "env" | "auto" | "unavailable" }> {
  const settingsPath = getSetting("godotPath")?.trim() || undefined;
  const envPath = process.env.GODOT_PATH?.trim() || undefined;
  const configured = settingsPath || envPath;
  const detected = await detectGodotExecutable(configured);
  if (!detected) {
    return {
      path: configured,
      source: settingsPath ? "settings" : envPath ? "env" : "unavailable",
    };
  }

  if (persist && detected !== configured) {
    saveGodotPathSetting(detected);
    resetMcpInstances();
  }

  return {
    path: detected,
    source:
      settingsPath && detected === settingsPath
        ? "settings"
        : envPath && detected === envPath
          ? "env"
          : "auto",
  };
}

function syncConnectionStatus(projectId: string, status: "connected" | "disconnected") {
  if (!dbRef) return;
  const existing = dbRef
    .select()
    .from(mcpConnections)
    .where(eq(mcpConnections.projectId, projectId))
    .get();
  if (!existing) return;

  dbRef
    .update(mcpConnections)
    .set({
      status,
      lastConnected: status === "connected" ? Date.now() : existing.lastConnected ?? null,
    })
    .where(eq(mcpConnections.projectId, projectId))
    .run();
}

function ensureRelayStarted() {
  if (relayStarted) return;
  sharedWsRelay.start();

  sharedWsRelay.on("connect", (projectId: string) => {
    syncConnectionStatus(projectId, "connected");
    emitEvent("mcp:connect", { projectId });
  });
  sharedWsRelay.on("disconnect", (projectId: string) => {
    syncConnectionStatus(projectId, "disconnected");
    emitEvent("mcp:disconnect", { projectId });
  });
  sharedWsRelay.on("log", (line: string, projectId: string) => {
    emitEvent("mcp:log", { line, projectId });
  });
  sharedWsRelay.on("error", (err: NodeJS.ErrnoException) => {
    if (err.code === "EADDRINUSE") {
      relayStarted = true;
      return;
    }
    emitEvent("mcp:log", { line: `[relay] ${err.message}`, projectId: "*" });
  });

  relayStarted = true;
}

export function getMcpInstance(projectId: string): McpGodotServer | null {
  return instances.get(projectId) ?? null;
}

export function startMcp(projectId: string) {
  ensureRelayStarted();

  let mcpInstance = instances.get(projectId);
  if (!mcpInstance) {
    mcpInstance = new McpGodotServer({ projectId, godotPath: getGodotPathSetting() });
    instances.set(projectId, mcpInstance);
  }

  return mcpInstance;
}

export function ensureProjectMcp(projectId: string) {
  return startMcp(projectId);
}

export function stopMcp(projectId?: string) {
  if (projectId !== undefined) {
    instances.get(projectId)?.stop();
    instances.delete(projectId);
    return;
  }

  for (const [id, instance] of instances) {
    instance.stop();
    instances.delete(id);
  }
  sharedWsRelay.stop();
  relayStarted = false;
}

export function resetMcpInstances() {
  for (const [id, instance] of instances) {
    instance.stop();
    instances.delete(id);
  }
}

export function getMcpStatus(projectId: string) {
  const instance = startMcp(projectId);
  return instance.getStatus();
}

export function getAllMcpStatuses() {
  const projectIds = [...instances.keys()];
  if (projectIds.length === 0) {
    ensureRelayStarted();
    return sharedWsRelay.getConnectedProjectIds().map((id) => getMcpStatus(id));
  }
  return projectIds.map((id) => getMcpStatus(id));
}

export function getDefaultRelayUrl(projectId: string) {
  return buildProjectWsUrl(projectId, Number(process.env.WS_PORT ?? WS_BASE_PORT));
}

export async function callMcpTool(projectId: string, name: string, args: Record<string, unknown> = {}) {
  const instance = startMcp(projectId);
  const tool = instance.getAllTools().find((t) => t.name === name);
  if (!tool) {
    throw new Error(`Tool not found: ${name}`);
  }

  if (tool.source === "cli") {
    const { GodotCliService } = await import("@godhand/mcp-godot/lib");
    const godotPath = await resolveGodotPath();
    const projectPath = typeof args.projectPath === "string" && args.projectPath.trim()
      ? args.projectPath
      : getProjectPath(projectId);
    const cli = new GodotCliService({ godotPath });
    return cli.callTool(name, projectPath ? { ...args, projectPath } : args);
  }

  const relay = instance.getProjectRelay();
  const result = await relay.call(name, args);
  return { result };
}

export function getPluginRuntimeVersion() {
  return getPluginVersion();
}

export function setMcpDb(db: Db) {
  dbRef = db;
}

export function initMcpRelay() {
  ensureRelayStarted();
}

export { sharedWsRelay };
