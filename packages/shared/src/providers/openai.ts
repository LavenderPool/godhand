import type { ImageGenRequest, ImageGenResult, ImageProvider } from "../interfaces.js";

export class OpenAIImageProvider implements ImageProvider {
  id = "openai";
  name = "OpenAI";
  models = ["dall-e-3", "gpt-image-1", "dall-e-2"];

  async generate(req: ImageGenRequest): Promise<ImageGenResult> {
    const size = req.size?.replace("x", "x") ?? "1024x1024";
    const model = req.model || "dall-e-3";

    const body: Record<string, unknown> = {
      model,
      prompt: req.style ? `${req.prompt}, style: ${req.style}` : req.prompt,
      n: 1,
      size,
      response_format: "b64_json",
    };

    const res = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${req.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`OpenAI API error: ${res.status} ${err}`);
    }

    const data = (await res.json()) as {
      data: Array<{ b64_json?: string; revised_prompt?: string }>;
    };

    const item = data.data[0];
    return {
      imageBase64: item?.b64_json,
      revisedPrompt: item?.revised_prompt,
      metadata: { provider: this.id, model },
    };
  }

  async testConnection(apiKey: string): Promise<boolean> {
    const res = await fetch("https://api.openai.com/v1/models", {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    return res.ok;
  }
}
