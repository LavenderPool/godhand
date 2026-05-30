const API_BASE = import.meta.env.VITE_API_URL ?? "/api/v1";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const headers = new Headers(options?.headers);
  if (options?.body !== undefined && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || res.statusText);
  }
  return res.json() as Promise<T>;
}

export interface Project {
  id: string;
  name: string;
  path: string;
  godotVersion: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface McpStatus {
  connected: boolean;
  projectId: string | null;
  wsPort: number;
  relayUrl: string;
  pluginVersion: string | null;
  connectedProjectIds: string[];
  toolCount: number;
  memoryOnline?: boolean;
}

export interface McpConnection {
  relayUrl: string;
  status: string;
  lastConnected: number | null;
}

export interface McpToolDefinition {
  name: string;
  description: string;
  source: "plugin" | "cli";
  inputSchema: Record<string, unknown>;
}

export interface Generation {
  id: string;
  projectId: string;
  prompt: string;
  imagePath: string;
  model: string;
  metadata: string;
  createdAt: number;
}

export interface SkillCard {
  id: string;
  name: string;
  description: string;
  category: string;
  filePath: string;
  enabled: boolean;
}

export interface ProviderSetting {
  id: string;
  name: string;
  models: string[];
  description?: string;
  enabled: boolean;
  apiKeyMasked: string;
}

export interface FileTreeNode {
  name: string;
  path: string;
  type: "file" | "directory";
  children?: FileTreeNode[];
  extension?: string;
}

export interface ConnectCursorResult {
  success?: boolean;
  configPath?: string;
  rulesPath?: string;
  mcpEntryPath?: string;
  relayUrl?: string;
  pluginInstalled?: boolean;
  pluginPath?: string;
  godotPath?: string;
  detectedFrom?: "settings" | "env" | "auto" | "unavailable";
  env?: Record<string, string>;
  message?: string;
}

export const api = {
  getStatus: (projectId?: string) =>
    request<McpStatus>(`/status${projectId ? `?projectId=${encodeURIComponent(projectId)}` : ""}`),
  getProjects: () => request<Project[]>("/projects"),
  createProject: (name: string, path: string) =>
    request<Project>("/projects", { method: "POST", body: JSON.stringify({ name, path }) }),
  deleteProject: (id: string) => request(`/projects/${id}`, { method: "DELETE" }),
  getProject: (id: string) =>
    request<Project & { mcpConnection?: McpConnection; mcpStatus?: McpStatus; pluginInstalled?: boolean }>(
      `/projects/${id}`
    ),
  browseFolder: async () => {
    if (window.godhand?.browseFolder) {
      const path = await window.godhand.browseFolder();
      return { path };
    }
    return request<{ path: string | null }>("/browse-folder", { method: "POST", body: "{}" });
  },
  connectCursor: (projectId: string) =>
    request<ConnectCursorResult>("/cursor/connect-mcp", { method: "POST", body: JSON.stringify({ projectId }) }),
  startMcp: (projectId: string) =>
    request<McpStatus>(`/mcp/start?projectId=${encodeURIComponent(projectId)}`, { method: "POST", body: "{}" }),
  stopMcp: () =>
    request<{ stopped: boolean }>("/mcp/stop", { method: "POST", body: "{}" }),
  getMcpTools: (projectId: string) =>
    request<McpToolDefinition[]>(
      `/mcp/tools?projectId=${encodeURIComponent(projectId)}`
    ),
  getMcpLogs: (projectId: string) =>
    request<{ logs: string[] }>(`/mcp/logs?projectId=${encodeURIComponent(projectId)}`),
  callMcpTool: (projectId: string, name: string, args: Record<string, unknown>) =>
    request(
      `/mcp/tools/${encodeURIComponent(name)}/call?projectId=${encodeURIComponent(projectId)}`,
      { method: "POST", body: JSON.stringify(args) }
    ),
  getGenerations: (projectId: string) => request<Generation[]>(`/projects/${projectId}/generations`),
  generate: (projectId: string, body: Record<string, unknown>) =>
    request(`/projects/${projectId}/generate`, { method: "POST", body: JSON.stringify(body) }),
  getFiles: (projectId: string, path?: string) =>
    request<{ tree?: FileTreeNode[]; type?: string; content?: string }>(
      `/projects/${projectId}/files${path ? `?path=${encodeURIComponent(path)}` : ""}`
    ),
  getSkills: () => request<SkillCard[]>("/skills"),
  patchSkill: (id: string, enabled: boolean, skill: Partial<SkillCard>) =>
    request(`/skills/${id}`, { method: "PATCH", body: JSON.stringify({ enabled, ...skill }) }),
  detectGodot: () => request<{ path: string | null }>("/settings/detect-godot"),
  getSettings: () => request<Record<string, string>>("/settings"),
  patchSettings: (body: Record<string, string>) =>
    request("/settings", { method: "PATCH", body: JSON.stringify(body) }),
  getProviders: () => request<ProviderSetting[]>("/settings/providers"),
  patchProvider: (id: string, body: Record<string, unknown>) =>
    request(`/settings/providers/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  testProvider: (id: string) => request<{ ok: boolean }>(`/settings/providers/${id}/test`, { method: "POST", body: "{}" }),
  getProviderCredits: (id: string) => request<{ credits: number }>(`/settings/providers/${id}/credits`),
  openInCursor: (filePath: string) =>
    request("/files/open-in-cursor", { method: "POST", body: JSON.stringify({ filePath }) }),
  imageUrl: (path: string) => `${API_BASE}/generations/image?path=${encodeURIComponent(path)}`,
};

export function subscribeEvents(onEvent: (event: { type: string; payload: unknown }) => void) {
  const es = new EventSource(`${API_BASE}/events`);
  es.onmessage = (e) => {
    try {
      onEvent(JSON.parse(e.data));
    } catch {
      /* ignore */
    }
  };
  return () => es.close();
}
