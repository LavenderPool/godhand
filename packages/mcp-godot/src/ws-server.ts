import { WebSocketServer, WebSocket } from "ws";
import { EventEmitter } from "events";
import { createServer, type Server as HttpServer } from "http";
import { MCP_LOG_MAX_LINES, WS_BASE_PORT } from "@godhand/shared";

export interface SharedWsRelayOptions {
  port?: number;
}

export interface ProjectRelay {
  readonly projectId: string;
  call(method: string, params?: Record<string, unknown>, timeoutMs?: number): Promise<unknown>;
  isConnected(): boolean;
  getConnectedCount(): number;
  getLogs(): string[];
}

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (err: Error) => void;
  timer: ReturnType<typeof setTimeout>;
  projectId: string;
}

export function parseProjectIdFromUrl(url: string): string | null {
  try {
    const normalized = url.startsWith("/") ? `http://localhost${url}` : url;
    const u = new URL(normalized);
    const fromQuery = u.searchParams.get("projectId");
    if (fromQuery) return fromQuery;

    const parts = u.pathname.split("/").filter(Boolean);
    if (parts[0] === "ws" && parts[1]) return decodeURIComponent(parts[1]);
    if (parts[0]) return decodeURIComponent(parts[0]);
  } catch {
    /* ignore malformed URLs */
  }
  return null;
}

export function buildProjectWsUrl(projectId: string, port = WS_BASE_PORT, host = "127.0.0.1"): string {
  return `ws://${host}:${port}/ws/${encodeURIComponent(projectId)}`;
}

export class SharedWsRelay extends EventEmitter {
  private httpServer: HttpServer | null = null;
  private wss: WebSocketServer | null = null;
  private clients = new Map<string, Set<WebSocket>>();
  private pending = new Map<string | number, PendingRequest>();
  private requestId = 1;
  private logs = new Map<string, string[]>();
  readonly port: number;
  private started = false;
  private startError: Error | null = null;

  constructor(private options: SharedWsRelayOptions = {}) {
    super();
    this.port = options.port ?? WS_BASE_PORT;
  }

  start(): void {
    if (this.started || this.wss) return;

    this.httpServer = createServer();
    this.wss = new WebSocketServer({ server: this.httpServer });

    this.wss.on("connection", (ws, req) => {
      const projectId = parseProjectIdFromUrl(req.url ?? "");
      if (!projectId) {
        ws.close(1008, "Missing projectId in URL path or query");
        return;
      }

      let projectClients = this.clients.get(projectId);
      const wasEmpty = !projectClients || projectClients.size === 0;
      if (!projectClients) {
        projectClients = new Set();
        this.clients.set(projectId, projectClients);
      }
      projectClients.add(ws);

      this.log(projectId, `Client connected (${projectClients.size} total)`);
      if (wasEmpty) {
        this.emit("connect", projectId);
      }

      ws.on("message", (data) => {
        this.handleMessage(data.toString(), projectId);
      });

      ws.on("close", () => {
        projectClients!.delete(ws);
        this.log(projectId, `Client disconnected (${projectClients!.size} remaining)`);
        if (projectClients!.size === 0) {
          this.clients.delete(projectId);
          this.emit("disconnect", projectId);
        }
      });

      ws.on("error", (err) => {
        this.log(projectId, `WS error: ${err.message}`);
      });
    });

    this.httpServer.on("error", (err: NodeJS.ErrnoException) => {
      this.startError = err;
      this.emit("error", err);
    });

    this.httpServer.listen(this.port, () => {
      this.started = true;
      this.log("*", `WebSocket relay listening on ws://127.0.0.1:${this.port}/ws/{projectId}`);
    });
  }

  stop(): void {
    for (const [, pending] of this.pending) {
      clearTimeout(pending.timer);
      pending.reject(new Error("Server stopped"));
    }
    this.pending.clear();

    for (const [, clientSet] of this.clients) {
      for (const ws of clientSet) {
        ws.close();
      }
    }
    this.clients.clear();

    this.wss?.close();
    this.httpServer?.close();
    this.wss = null;
    this.httpServer = null;
    this.started = false;
  }

  forProject(projectId: string): ProjectRelay {
    return new ProjectRelayAdapter(this, projectId);
  }

  isConnected(projectId: string): boolean {
    const set = this.clients.get(projectId);
    return !!set && set.size > 0;
  }

  getConnectedProjectIds(): string[] {
    return [...this.clients.keys()].filter((id) => this.isConnected(id));
  }

  getConnectedCount(projectId: string): number {
    return this.clients.get(projectId)?.size ?? 0;
  }

  getLogs(projectId?: string): string[] {
    if (projectId) {
      return [...(this.logs.get(projectId) ?? [])];
    }
    return [...this.logs.values()].flat();
  }

  getStartError(): Error | null {
    return this.startError;
  }

  isStarted(): boolean {
    return this.started;
  }

  async call(
    projectId: string,
    method: string,
    params: Record<string, unknown> = {},
    timeoutMs = 60000
  ): Promise<unknown> {
    if (!this.isConnected(projectId)) {
      throw new Error(`No Godot plugin connected for project ${projectId}`);
    }

    const id = this.requestId++;
    const message = JSON.stringify({ jsonrpc: "2.0", id, method, params });

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Timeout waiting for ${method}`));
      }, timeoutMs);

      this.pending.set(id, { resolve, reject, timer, projectId });
      this.broadcast(projectId, message);
    });
  }

  private broadcast(projectId: string, text: string): void {
    const clientSet = this.clients.get(projectId);
    if (!clientSet) return;

    for (const ws of clientSet) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(text);
      }
    }
  }

  private handleMessage(text: string, projectId: string): void {
    this.log(projectId, `<< ${text.slice(0, 200)}`);

    let msg: Record<string, unknown>;
    try {
      msg = JSON.parse(text);
    } catch {
      return;
    }

    if (msg.method === "ping") {
      this.broadcast(projectId, JSON.stringify({ jsonrpc: "2.0", method: "pong", params: {} }));
      return;
    }

    if (msg.method === "pong") return;

    const id = msg.id;
    if (id !== undefined && this.pending.has(id as string | number)) {
      const pending = this.pending.get(id as string | number)!;
      if (pending.projectId !== projectId) return;

      clearTimeout(pending.timer);
      this.pending.delete(id as string | number);

      if (msg.error) {
        pending.reject(new Error(JSON.stringify(msg.error)));
      } else {
        pending.resolve(msg.result);
      }
    }
  }

  private log(projectId: string, line: string): void {
    const entry = `[${new Date().toISOString()}] [${projectId}] ${line}`;
    let projectLogs = this.logs.get(projectId);
    if (!projectLogs) {
      projectLogs = [];
      this.logs.set(projectId, projectLogs);
    }
    projectLogs.push(entry);
    if (projectLogs.length > MCP_LOG_MAX_LINES) {
      projectLogs.shift();
    }
    this.emit("log", entry, projectId);
  }
}

class ProjectRelayAdapter implements ProjectRelay {
  readonly projectId: string;

  constructor(
    private relay: SharedWsRelay,
    projectId: string
  ) {
    this.projectId = projectId;
  }

  call(method: string, params: Record<string, unknown> = {}, timeoutMs = 60000): Promise<unknown> {
    return this.relay.call(this.projectId, method, params, timeoutMs);
  }

  isConnected(): boolean {
    return this.relay.isConnected(this.projectId);
  }

  getConnectedCount(): number {
    return this.relay.getConnectedCount(this.projectId);
  }

  getLogs(): string[] {
    return this.relay.getLogs(this.projectId);
  }
}

export class HttpRelayClient extends EventEmitter implements ProjectRelay {
  readonly projectId: string;
  private connected = false;
  private cachedLogs: string[] = [];

  constructor(
    private apiUrl: string,
    projectId: string
  ) {
    super();
    this.projectId = projectId;
  }

  async refreshStatus(): Promise<boolean> {
    try {
      const url = new URL(`${this.apiUrl}/status`);
      url.searchParams.set("projectId", this.projectId);
      const res = await fetch(url);
      if (!res.ok) return false;
      const data = (await res.json()) as { connected?: boolean; logs?: string[] };
      this.connected = !!data.connected;
      return this.connected;
    } catch {
      this.connected = false;
      return false;
    }
  }

  isConnected(): boolean {
    return this.connected;
  }

  getConnectedCount(): number {
    return this.connected ? 1 : 0;
  }

  getLogs(): string[] {
    return [...this.cachedLogs];
  }

  async refreshLogs(): Promise<string[]> {
    try {
      const url = new URL(`${this.apiUrl}/mcp/logs`);
      url.searchParams.set("projectId", this.projectId);
      const res = await fetch(url);
      if (!res.ok) return this.cachedLogs;
      const data = (await res.json()) as { logs?: string[] };
      this.cachedLogs = data.logs ?? [];
      return this.getLogs();
    } catch {
      return this.getLogs();
    }
  }

  async call(method: string, params: Record<string, unknown> = {}): Promise<unknown> {
    const url = new URL(`${this.apiUrl}/mcp/tools/${encodeURIComponent(method)}/call`);
    url.searchParams.set("projectId", this.projectId);

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || res.statusText);
    }

    const data = (await res.json()) as { result?: unknown; content?: unknown };
    if (data.result !== undefined) return data.result;
    return data;
  }
}

export const sharedWsRelay = new SharedWsRelay();

/** @deprecated Use sharedWsRelay instead */
export class WsRelayServer extends EventEmitter {
  readonly port: number;
  private adapter: ProjectRelay;

  constructor(options: { port: number; projectId?: string; onConnect?: () => void; onDisconnect?: () => void }) {
    super();
    this.port = options.port;
    const projectId = options.projectId ?? "default";
    this.adapter = sharedWsRelay.forProject(projectId);

    sharedWsRelay.on("connect", (id: string) => {
      if (id === projectId) {
        options.onConnect?.();
        this.emit("connect");
      }
    });
    sharedWsRelay.on("disconnect", (id: string) => {
      if (id === projectId) {
        options.onDisconnect?.();
        this.emit("disconnect");
      }
    });
    sharedWsRelay.on("log", (line: string, id: string) => {
      if (id === projectId) this.emit("log", line);
    });
  }

  start(): void {
    sharedWsRelay.start();
  }

  stop(): void {
    /* relay lifecycle managed globally */
  }

  isConnected(): boolean {
    return this.adapter.isConnected();
  }

  getConnectedCount(): number {
    return this.adapter.getConnectedCount();
  }

  getLogs(): string[] {
    return this.adapter.getLogs();
  }

  call(method: string, params: Record<string, unknown> = {}, timeoutMs = 60000): Promise<unknown> {
    return this.adapter.call(method, params, timeoutMs);
  }
}

/** @deprecated Use sharedWsRelay instead */
export class WsPortPool {
  getOrCreate(_port: number, options?: { projectId?: string }): WsRelayServer {
    sharedWsRelay.start();
    return new WsRelayServer({ port: sharedWsRelay.port, projectId: options?.projectId });
  }

  get(_port: number): WsRelayServer | undefined {
    return undefined;
  }

  getAll(): WsRelayServer[] {
    return [];
  }

  stopAll(): void {
    sharedWsRelay.stop();
  }
}

/** @deprecated Use sharedWsRelay instead */
export const wsPortPool = new WsPortPool();
