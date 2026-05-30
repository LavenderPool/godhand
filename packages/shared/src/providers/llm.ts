import type { LLMProvider, LLMRequest, LLMResponse } from "../interfaces.js";

export class OpenAILLMProvider implements LLMProvider {
  id = "openai";
  name = "OpenAI";
  models = ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo"];

  async complete(req: LLMRequest): Promise<LLMResponse> {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${req.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: req.model,
        messages: req.messages,
        max_tokens: req.maxTokens ?? 4096,
      }),
    });

    if (!res.ok) throw new Error(`OpenAI LLM error: ${await res.text()}`);

    const data = (await res.json()) as {
      choices: Array<{ message: { content: string } }>;
      model: string;
      usage?: { prompt_tokens: number; completion_tokens: number };
    };

    return {
      content: data.choices[0]?.message?.content ?? "",
      model: data.model,
      usage: data.usage
        ? {
            promptTokens: data.usage.prompt_tokens,
            completionTokens: data.usage.completion_tokens,
          }
        : undefined,
    };
  }

  async testConnection(apiKey: string): Promise<boolean> {
    const res = await fetch("https://api.openai.com/v1/models", {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    return res.ok;
  }
}

export class AnthropicLLMProvider implements LLMProvider {
  id = "anthropic";
  name = "Anthropic";
  models = ["claude-sonnet-4-20250514", "claude-3-5-sonnet-20241022"];

  async complete(req: LLMRequest): Promise<LLMResponse> {
    const system = req.messages.find((m) => m.role === "system")?.content ?? "";
    const messages = req.messages.filter((m) => m.role !== "system");

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": req.apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: req.model,
        max_tokens: req.maxTokens ?? 4096,
        system,
        messages,
      }),
    });

    if (!res.ok) throw new Error(`Anthropic error: ${await res.text()}`);

    const data = (await res.json()) as {
      content: Array<{ text: string }>;
      model: string;
      usage?: { input_tokens: number; output_tokens: number };
    };

    return {
      content: data.content.map((c) => c.text).join(""),
      model: data.model,
      usage: data.usage
        ? {
            promptTokens: data.usage.input_tokens,
            completionTokens: data.usage.output_tokens,
          }
        : undefined,
    };
  }

  async testConnection(apiKey: string): Promise<boolean> {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 1,
        messages: [{ role: "user", content: "hi" }],
      }),
    });
    return res.ok || res.status === 400;
  }
}

export class OllamaLLMProvider implements LLMProvider {
  id = "ollama";
  name = "Ollama";
  models = ["llama3.2", "mistral", "codellama"];

  constructor(private baseUrl = "http://localhost:11434") {}

  async complete(req: LLMRequest): Promise<LLMResponse> {
    const res = await fetch(`${this.baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: req.model,
        messages: req.messages,
        stream: false,
      }),
    });

    if (!res.ok) throw new Error(`Ollama error: ${await res.text()}`);

    const data = (await res.json()) as {
      message: { content: string };
      model: string;
    };

    return { content: data.message.content, model: data.model };
  }

  async testConnection(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/api/tags`);
      return res.ok;
    } catch {
      return false;
    }
  }
}
