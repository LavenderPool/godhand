import type { ImageSize, ImageStyle } from "./constants.js";

export interface ImageGenRequest {
  prompt: string;
  model: string;
  size?: ImageSize;
  style?: ImageStyle;
  apiKey: string;
  metadata?: Record<string, unknown>;
}

export interface ImageGenResult {
  imageUrl?: string;
  imageBase64?: string;
  imageBuffer?: Buffer;
  revisedPrompt?: string;
  metadata?: Record<string, unknown>;
}

export interface ImageProvider {
  id: string;
  name: string;
  models: string[];
  generate(req: ImageGenRequest): Promise<ImageGenResult>;
  testConnection(apiKey: string): Promise<boolean>;
}

export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LLMRequest {
  messages: LLMMessage[];
  model: string;
  apiKey: string;
  maxTokens?: number;
}

export interface LLMResponse {
  content: string;
  model: string;
  usage?: { promptTokens: number; completionTokens: number };
}

export interface LLMProvider {
  id: string;
  name: string;
  models: string[];
  complete(req: LLMRequest): Promise<LLMResponse>;
  testConnection(apiKey: string): Promise<boolean>;
}

export interface SkillContext {
  projectId: string;
  projectPath: string;
}

export interface SkillPlugin {
  id: string;
  name: string;
  description: string;
  category: string;
  systemPrompt: string;
  execute?(ctx: SkillContext): Promise<void>;
}

export interface StorageAdapter {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<void>;
  list(prefix: string): Promise<string[]>;
}
