import type { ImageGenRequest, ImageGenResult, ImageProvider } from "../interfaces.js";

const FAL_BASE = "https://fal.run";

export class FluxImageProvider implements ImageProvider {
  id = "flux";
  name = "Flux (fal.ai)";
  models = ["fal-ai/flux-pro", "fal-ai/flux/dev", "fal-ai/flux/schnell"];

  async generate(req: ImageGenRequest): Promise<ImageGenResult> {
    const model = req.model || "fal-ai/flux/dev";
    const [w, h] = (req.size ?? "1024x1024").split("x").map(Number);

    const res = await fetch(`${FAL_BASE}/${model}`, {
      method: "POST",
      headers: {
        Authorization: `Key ${req.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt: req.style ? `${req.prompt}, ${req.style} style` : req.prompt,
        image_size: { width: w, height: h },
        num_images: 1,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Flux API error: ${res.status} ${err}`);
    }

    const data = (await res.json()) as {
      images?: Array<{ url?: string; content_type?: string }>;
    };

    const imageUrl = data.images?.[0]?.url;
    if (!imageUrl) throw new Error("Flux API returned no image");

    const imgRes = await fetch(imageUrl);
    const buffer = Buffer.from(await imgRes.arrayBuffer());

    return {
      imageUrl,
      imageBuffer: buffer,
      metadata: { provider: this.id, model },
    };
  }

  async testConnection(apiKey: string): Promise<boolean> {
    const res = await fetch("https://fal.run/fal-ai/flux/dev", {
      method: "POST",
      headers: {
        Authorization: `Key ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ prompt: "test", image_size: { width: 64, height: 64 }, num_images: 1 }),
    });
    return res.ok || res.status === 422;
  }
}
