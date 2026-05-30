export interface Project {
  id: string;
  name: string;
  path: string;
  godotVersion: string | null;
  createdAt: number;
  updatedAt: number;
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

export interface Skill {
  id: string;
  name: string;
  description: string;
  filePath: string;
  enabled: number;
  category: string;
  projectId: string | null;
}

export interface McpConnection {
  id: string;
  projectId: string;
  status: string;
  lastConnected: number | null;
  relayUrl: string;
}

export interface ProviderCredential {
  id: string;
  providerId: string;
  apiKey: string;
  enabled: number;
  metadata: string;
}

export interface AppSetting {
  key: string;
  value: string;
}

export interface McpToolDefinition {
  name: string;
  description: string;
  source: "plugin" | "cli" | "builtin";
  inputSchema: Record<string, unknown>;
  /** Optional grouping for discoverability (e.g. "2d", "3d", "mobile"). */
  category?: string;
  /** Optional usage examples shown to the AI to improve call accuracy. */
  examples?: McpToolExample[];
}

export interface McpToolExample {
  /** Short human-readable description of what this example does. */
  description?: string;
  /** Example arguments object for the tool. */
  arguments: Record<string, unknown>;
}

export interface McpStatus {
  connected: boolean;
  projectId: string | null;
  wsPort: number;
  relayUrl: string;
  pluginVersion: string | null;
  connectedProjectIds: string[];
  toolCount: number;
}

export interface FileTreeNode {
  name: string;
  path: string;
  type: "file" | "directory";
  children?: FileTreeNode[];
  extension?: string;
}

export interface SkillCard {
  id: string;
  name: string;
  description: string;
  category: string;
  filePath: string;
  enabled: boolean;
}

export interface AppEvent {
  type: string;
  payload: unknown;
  timestamp: number;
}

export interface ProviderInfo {
  id: string;
  name: string;
  models: string[];
  description?: string;
}

export interface MaskedProviderCredential {
  id: string;
  providerId: string;
  apiKeyMasked: string;
  enabled: boolean;
  metadata: Record<string, unknown>;
}
