import { OpenAIImageProvider } from "./openai.js";
import { FluxImageProvider } from "./flux.js";
import { FalImageProvider } from "./fal.js";
import { BflImageProvider } from "./bfl.js";
import type { ImageProvider } from "../interfaces.js";
import { AnthropicLLMProvider, OllamaLLMProvider, OpenAILLMProvider } from "./llm.js";
import type { LLMProvider } from "../interfaces.js";

export { OpenAIImageProvider, FluxImageProvider, FalImageProvider, BflImageProvider };
export { OpenAILLMProvider, AnthropicLLMProvider, OllamaLLMProvider };

const imageProviders: ImageProvider[] = [
  new OpenAIImageProvider(),
  new FluxImageProvider(),
  new FalImageProvider(),
  new BflImageProvider(),
];

const llmProviders: LLMProvider[] = [
  new OpenAILLMProvider(),
  new AnthropicLLMProvider(),
  new OllamaLLMProvider(),
];

export function getImageProvider(id: string): ImageProvider | undefined {
  return imageProviders.find((p) => p.id === id);
}

export function getAllImageProviders(): ImageProvider[] {
  return imageProviders;
}

export function getLLMProvider(id: string): LLMProvider | undefined {
  return llmProviders.find((p) => p.id === id);
}

export function getAllLLMProviders(): LLMProvider[] {
  return llmProviders;
}
