import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import { existsSync, readFileSync } from "fs";
import { join, resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { execa } from "execa";
import {
  projects,
  mcpConnections,
  providerCredentials,
  appSettings,
  skills,
} from "@godhand/db";
import type { Db } from "@godhand/db";
import {
  API_PREFIX,
  maskApiKey,
  parseJsonSafe,
  now,
} from "@godhand/shared";
import { eventBus } from "./events.js";
import {
  getMcpStatus,
  startMcp,
  stopMcp,
  ensureProjectMcp,
  sharedWsRelay,
  callMcpTool,
  getPluginRuntimeVersion,
  setMcpDb,
  resetMcpInstances,
} from "./services/mcp.js";
import { ensureProjectRuntimeConfig, setupGodhandProject } from "./services/project-config.js";
import { buildFileTree, loadSkillFiles } from "./services/files.js";
import type { SkillCard } from "@godhand/shared";
import { generateSprite, getGenerations } from "./services/generation.js";
import { isMemoryOnline, memoryAdd, memorySearch } from "./services/memory.js";

const serverDir = dirname(fileURLToPath(import.meta.url));
const serverRoot = resolve(serverDir, "..");

function getGodhandApiUrl(req: { headers: { host?: string } }): string {
  const host = req.headers.host ?? `127.0.0.1:${process.env.PORT ?? "3001"}`;
  return `http://${host}${API_PREFIX}`;
}

function resolveProjectId(
  db: Db,
  query: { projectId?: string },
  body?: { projectId?: string }
): string | null {
  return body?.projectId ?? query.projectId ?? null;
}

function getGodotPathSetting(db: Db): string {
  return db.select().from(appSettings).where(eq(appSettings.key, "godotPath")).get()?.value
    ?? process.env.GODOT_PATH
    ?? "";
}

export async function registerRoutes(app: FastifyInstance, db: Db) {
  const api = `${API_PREFIX}`;
  setMcpDb(db);

  app.get(`${api}/status`, async (req) => {
    const query = req.query as { projectId?: string };
    const memoryOnline = await isMemoryOnline();

    if (query.projectId) {
      return { ...getMcpStatus(query.projectId), memoryOnline };
    }

    const connectedIds = sharedWsRelay.getConnectedProjectIds();
    const toolCount = connectedIds.length > 0 ? startMcp(connectedIds[0]).getAllTools().length : 0;

    return {
      connected: connectedIds.length > 0,
      projectId: null,
      wsPort: sharedWsRelay.port,
      relayUrl: `ws://127.0.0.1:${sharedWsRelay.port}/ws/{projectId}`,
      pluginVersion: getPluginRuntimeVersion(),
      connectedProjectIds: connectedIds,
      toolCount,
      memoryOnline,
    };
  });

  app.post(`${api}/mcp/start`, async (req) => {
    const body = (req.body ?? {}) as { projectId?: string };
    const query = req.query as { projectId?: string };
    const projectId = resolveProjectId(db, query, body);
    if (!projectId) return { error: "projectId is required" };
    startMcp(projectId);
    return getMcpStatus(projectId);
  });

  app.post(`${api}/mcp/stop`, async () => {
    stopMcp();
    return { stopped: true };
  });

  app.get(`${api}/mcp/tools`, async (req, reply) => {
    const query = req.query as { projectId?: string };
    if (!query.projectId) return reply.status(400).send({ error: "projectId is required" });
    const instance = startMcp(query.projectId);
    return instance.getAllTools();
  });

  app.post(`${api}/mcp/tools/:name/call`, async (req, reply) => {
    const { name } = req.params as { name: string };
    const query = req.query as { projectId?: string };
    const body = req.body as Record<string, unknown>;
    if (!query.projectId) return reply.status(400).send({ error: "projectId is required" });

    try {
      return await callMcpTool(query.projectId, name, body);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.startsWith("Tool not found") || message.startsWith("Unknown tool")) {
        return reply.status(404).send({ error: message });
      }
      return reply.status(400).send({ error: message });
    }
  });

  app.get(`${api}/mcp/logs`, async (req, reply) => {
    const query = req.query as { projectId?: string };
    if (!query.projectId) return reply.status(400).send({ error: "projectId is required" });
    const instance = startMcp(query.projectId);
    return { logs: instance.getProjectRelay().getLogs() };
  });

  app.get(`${api}/events`, async (req, reply) => {
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
    });

    const send = (event: { type: string; payload: unknown; timestamp: number }) => {
      reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
    };

    const handler = (event: { type: string; payload: unknown; timestamp: number }) => send(event);
    eventBus.on("event", handler);

    req.raw.on("close", () => {
      eventBus.off("event", handler);
    });

    const keepAlive = setInterval(() => {
      reply.raw.write(": keepalive\n\n");
    }, 15000);

    req.raw.on("close", () => clearInterval(keepAlive));
  });

  app.get(`${api}/projects`, async () => db.select().from(projects).all());

  app.post(`${api}/projects`, async (req) => {
    const body = req.body as { name: string; path: string };
    const id = uuid();
    const ts = now();
    const setup = await ensureProjectRuntimeConfig(id, body.path, getGodhandApiUrl(req));

    await db.insert(projects).values({
      id,
      name: body.name,
      path: body.path,
      godotVersion: null,
      createdAt: ts,
      updatedAt: ts,
    });

    await db.insert(mcpConnections).values({
      id: uuid(),
      projectId: id,
      status: "disconnected",
      lastConnected: null,
      relayUrl: setup.relayUrl,
    });

    ensureProjectMcp(id);

    return db.select().from(projects).where(eq(projects.id, id)).get();
  });

  app.get(`${api}/projects/:id`, async (req, reply) => {
    const { id } = req.params as { id: string };
    const project = db.select().from(projects).where(eq(projects.id, id)).get();
    if (!project) return reply.status(404).send({ error: "Project not found" });

    const connection = db
      .select()
      .from(mcpConnections)
      .where(eq(mcpConnections.projectId, id))
      .get();

    let pluginInstalled = false;
    if (connection) {
      ensureProjectMcp(id);
      const setup = setupGodhandProject(id, project.path);
      pluginInstalled = setup.pluginInstalled;
    }

    return {
      ...project,
      mcpConnection: connection,
      mcpStatus: connection ? getMcpStatus(id) : null,
      pluginInstalled,
    };
  });

  app.delete(`${api}/projects/:id`, async (req) => {
    const { id } = req.params as { id: string };
    await db.delete(projects).where(eq(projects.id, id));
    return { deleted: true };
  });

  app.get(`${api}/projects/:id/files`, async (req, reply) => {
    const { id } = req.params as { id: string };
    const query = req.query as { path?: string };
    const project = db.select().from(projects).where(eq(projects.id, id)).get();
    if (!project) return reply.status(404).send({ error: "Project not found" });

    const subPath = query.path ?? "";
    const targetPath = join(project.path, subPath);
    if (!targetPath.startsWith(project.path)) {
      return reply.status(400).send({ error: "Invalid path" });
    }

    if (subPath && existsSync(targetPath)) {
      const stat = await import("fs").then((fs) => fs.statSync(targetPath));
      if (stat.isFile()) {
        return { type: "file", path: subPath, content: readFileSync(targetPath, "utf-8").slice(0, 100000) };
      }
    }

    return { tree: buildFileTree(targetPath, project.path) };
  });

  app.get(`${api}/projects/:id/generations`, async (req) => {
    const { id } = req.params as { id: string };
    return getGenerations(db, id);
  });

  app.post(`${api}/projects/:id/generate`, async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = req.body as {
      prompt: string;
      provider: string;
      model: string;
      size?: string;
      style?: string;
    };

    const project = db.select().from(projects).where(eq(projects.id, id)).get();
    if (!project) return reply.status(404).send({ error: "Project not found" });

    const cred = db
      .select()
      .from(providerCredentials)
      .where(eq(providerCredentials.providerId, body.provider))
      .get();

    if (!cred?.apiKey) {
      return reply.status(400).send({ error: `No API key configured for provider: ${body.provider}` });
    }

    const result = await generateSprite({
      db,
      projectId: id,
      projectPath: project.path,
      prompt: body.prompt,
      provider: body.provider,
      model: body.model,
      size: body.size as import("@godhand/shared").ImageSize | undefined,
      style: body.style as import("@godhand/shared").ImageStyle | undefined,
      apiKey: cred.apiKey,
    });

    try {
      if (await isMemoryOnline()) {
        await memoryAdd(id, body.prompt, result.imagePath);
      }
    } catch {
      /* graceful degradation */
    }

    return result;
  });

  app.post(`${api}/browse-folder`, async () => {
    if (process.platform === "win32") {
      const script = `
        Add-Type -AssemblyName System.Windows.Forms
        $d = New-Object System.Windows.Forms.FolderBrowserDialog
        if ($d.ShowDialog() -eq 'OK') { $d.SelectedPath }
      `;
      const { stdout } = await execa("powershell", ["-Command", script]);
      return { path: stdout.trim() || null };
    }
    try {
      const { stdout } = await execa("zenity", ["--file-selection", "--directory"]);
      return { path: stdout.trim() || null };
    } catch {
      return { path: null, error: "Folder dialog not available" };
    }
  });

  app.post(`${api}/cursor/connect-mcp`, async (req, reply) => {
    const body = req.body as { projectId: string };
    const project = db.select().from(projects).where(eq(projects.id, body.projectId)).get();
    if (!project) return reply.status(404).send({ error: "Project not found" });

    const result = await ensureProjectRuntimeConfig(body.projectId, project.path, getGodhandApiUrl(req));
    ensureProjectMcp(body.projectId);
    return {
      success: true,
      ...result,
      message: `MCP config updated at ${result.configPath}. Plugin updated at ${result.pluginPath}. Reload Cursor and Godot if already open.`,
    };
  });

  app.get(`${api}/skills`, async (req) => {
    const query = req.query as { projectId?: string };
    const fileSkills = loadSkillFiles();
    const dbSkills = db.select().from(skills).all();

    return fileSkills.map((s: SkillCard) => {
      const dbSkill = dbSkills.find((d: { id: string }) => d.id === s.id);
      return { ...s, enabled: dbSkill ? dbSkill.enabled === 1 : s.enabled };
    }).filter(() => true);
  });

  app.patch(`${api}/skills/:id`, async (req) => {
    const { id } = req.params as { id: string };
    const body = req.body as { enabled: boolean; name?: string; description?: string; filePath?: string; category?: string };

    const existing = db.select().from(skills).where(eq(skills.id, id)).get();
    if (existing) {
      await db
        .update(skills)
        .set({ enabled: body.enabled ? 1 : 0 })
        .where(eq(skills.id, id));
    } else {
      await db.insert(skills).values({
        id,
        name: body.name ?? id,
        description: body.description ?? "",
        filePath: body.filePath ?? "",
        enabled: body.enabled ? 1 : 0,
        category: body.category ?? "general",
        projectId: null,
      });
    }

    return { id, enabled: body.enabled };
  });

  app.get(`${api}/settings/detect-godot`, async () => {
    const current = getGodotPathSetting(db);
    const { detectGodotExecutable } = await import("@godhand/mcp-godot/lib");
    const path = await detectGodotExecutable(current || undefined);
    return { path };
  });

  app.get(`${api}/settings`, async () => {
    const rows = db.select().from(appSettings).all();
    const settings: Record<string, string> = {};
    for (const row of rows) settings[row.key] = row.value;
    return {
      theme: settings.theme ?? "system",
      language: settings.language ?? "ru",
      defaultImageProvider: settings.defaultImageProvider ?? "openai",
      godotPath: settings.godotPath ?? process.env.GODOT_PATH ?? "",
      memoryServiceUrl: settings.memoryServiceUrl ?? process.env.MEMORY_SERVICE_URL ?? "",
    };
  });

  app.patch(`${api}/settings`, async (req) => {
    const body = req.body as Record<string, string>;
    let shouldResetMcp = false;
    for (const [key, value] of Object.entries(body)) {
      if (key === "godotPath") {
        shouldResetMcp = true;
      }
      const existing = db.select().from(appSettings).where(eq(appSettings.key, key)).get();
      if (existing) {
        await db.update(appSettings).set({ value }).where(eq(appSettings.key, key));
      } else {
        await db.insert(appSettings).values({ key, value });
      }
    }
    if (shouldResetMcp) {
      resetMcpInstances();
    }
    return { updated: true };
  });

  app.get(`${api}/settings/providers`, async () => {
    const config = JSON.parse(
      readFileSync(join(serverRoot, "config/providers.json"), "utf-8")
    );
    const creds = db.select().from(providerCredentials).all();

    return config.map((p: { id: string; name: string; models: string[]; description?: string }) => {
      const cred = creds.find((c) => c.providerId === p.id);
      return {
        ...p,
        enabled: cred ? cred.enabled === 1 : false,
        apiKeyMasked: cred?.apiKey ? maskApiKey(cred.apiKey) : "",
        metadata: cred ? parseJsonSafe(cred.metadata, {}) : {},
      };
    });
  });

  app.patch(`${api}/settings/providers/:providerId`, async (req) => {
    const { providerId } = req.params as { providerId: string };
    const body = req.body as { apiKey?: string; enabled?: boolean; metadata?: Record<string, unknown> };

    const existing = db
      .select()
      .from(providerCredentials)
      .where(eq(providerCredentials.providerId, providerId))
      .get();

    if (existing) {
      await db
        .update(providerCredentials)
        .set({
          apiKey: body.apiKey !== undefined ? body.apiKey : existing.apiKey,
          enabled: body.enabled !== undefined ? (body.enabled ? 1 : 0) : existing.enabled,
          metadata: body.metadata ? JSON.stringify(body.metadata) : existing.metadata,
        })
        .where(eq(providerCredentials.providerId, providerId));
    } else {
      await db.insert(providerCredentials).values({
        id: uuid(),
        providerId,
        apiKey: body.apiKey ?? "",
        enabled: body.enabled ? 1 : 0,
        metadata: JSON.stringify(body.metadata ?? {}),
      });
    }

    return { providerId, updated: true };
  });

  app.post(`${api}/settings/providers/:providerId/test`, async (req) => {
    const { providerId } = req.params as { providerId: string };
    const { getImageProvider } = await import("@godhand/shared");

    const cred = db
      .select()
      .from(providerCredentials)
      .where(eq(providerCredentials.providerId, providerId))
      .get();

    if (!cred?.apiKey) return { ok: false, error: "No API key" };

    const provider = getImageProvider(providerId);
    if (!provider) return { ok: false, error: "Unknown provider" };

    const ok = await provider.testConnection(cred.apiKey);
    return { ok };
  });

  app.get(`${api}/settings/providers/:providerId/credits`, async (req, reply) => {
    const { providerId } = req.params as { providerId: string };

    if (providerId !== "bfl") {
      return reply.status(404).send({ error: "Credits not supported for this provider" });
    }

    const { getImageProvider } = await import("@godhand/shared");

    const cred = db
      .select()
      .from(providerCredentials)
      .where(eq(providerCredentials.providerId, providerId))
      .get();

    if (!cred?.apiKey) {
      return reply.status(400).send({ error: "No API key" });
    }

    const provider = getImageProvider(providerId);
    if (!provider || providerId !== "bfl") {
      return reply.status(404).send({ error: "Credits not supported for this provider" });
    }

    try {
      const credits = await (provider as import("@godhand/shared").BflImageProvider).getCredits(cred.apiKey);
      return { credits };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return reply.status(502).send({ error: message });
    }
  });

  app.post(`${api}/llm/complete`, async (req, reply) => {
    const body = req.body as {
      provider: string;
      model: string;
      messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
      projectId?: string;
    };

    const cred = db
      .select()
      .from(providerCredentials)
      .where(eq(providerCredentials.providerId, body.provider))
      .get();

    if (!cred?.apiKey && body.provider !== "ollama") {
      return reply.status(400).send({ error: "No API key for LLM provider" });
    }

    const { getLLMProvider } = await import("@godhand/shared");
    const provider = getLLMProvider(body.provider);
    if (!provider) return reply.status(400).send({ error: "Unknown LLM provider" });

    let systemPrompt = "";
    if (body.projectId) {
      const enabledSkills = db.select().from(skills).all().filter((s) => s.enabled === 1);
      systemPrompt = enabledSkills.map((s) => s.description).join("\n");
    }

    const messages = systemPrompt
      ? [{ role: "system" as const, content: systemPrompt }, ...body.messages]
      : body.messages;

    const result = await provider.complete({
      messages,
      model: body.model,
      apiKey: cred?.apiKey ?? "",
    });

    return result;
  });

  app.get(`${api}/llm/providers`, async () => {
    const { getAllLLMProviders } = await import("@godhand/shared");
    return getAllLLMProviders().map((p) => ({
      id: p.id,
      name: p.name,
      models: p.models,
    }));
  });

  app.get(`${api}/memory/search`, async (req) => {
    const query = req.query as { q?: string; projectId?: string };
    if (!(await isMemoryOnline())) {
      return { offline: true, results: [] };
    }
    return memorySearch(query.projectId ?? "", query.q ?? "");
  });

  app.post(`${api}/memory/add`, async (req) => {
    const body = req.body as { projectId: string; prompt: string; result: string };
    if (!(await isMemoryOnline())) {
      return { offline: true };
    }
    return memoryAdd(body.projectId, body.prompt, body.result);
  });

  app.post(`${api}/files/open-in-cursor`, async (req) => {
    const body = req.body as { filePath: string };
    const uri = `file:///${body.filePath.replace(/\\/g, "/")}`;
    try {
      await execa("cursor", ["--goto", body.filePath]);
    } catch {
      try {
        await execa("code", ["--goto", body.filePath]);
      } catch {
        return { opened: false, uri };
      }
    }
    return { opened: true, uri };
  });

  app.get(`${api}/generations/image`, async (req, reply) => {
    const query = req.query as { path: string };
    if (!existsSync(query.path)) return reply.status(404).send("Not found");
    const ext = query.path.split(".").pop()?.toLowerCase();
    const mime =
      ext === "png" ? "image/png" :
      ext === "jpg" || ext === "jpeg" ? "image/jpeg" :
      ext === "webp" ? "image/webp" : "application/octet-stream";
    return reply.type(mime).send(readFileSync(query.path));
  });
}
