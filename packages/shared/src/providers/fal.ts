import type { ImageGenRequest, ImageGenResult, ImageProvider } from "../interfaces.js";

const FAL_QUEUE = "https://queue.fal.run";

export class FalImageProvider implements ImageProvider {
  id = "fal";
  name = "fal.ai";
  models = [
    "fal-ai/flux/dev",
    "fal-ai/flux-pro",
    "fal-ai/fast-sdxl",
    "fal-ai/recraft-v3",
  ];

  async generate(req: ImageGenRequest): Promise<ImageGenResult> {
    const model = req.model || "fal-ai/flux/dev";
    const [w, h] = (req.size ?? "1024x1024").split("x").map(Number);

    const submitRes = await fetch(`${FAL_QUEUE}/${model}`, {
      method: "POST",
      headers: {
        Authorization: `Key ${req.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt: req.prompt,
        image_size: { width: w, height: h },
        num_images: 1,
      }),
    });

    if (!submitRes.ok) {
      const err = await submitRes.text();
      throw new Error(`fal.ai API error: ${submitRes.status} ${err}`);
    }

    const submitData = (await submitRes.json()) as {
      request_id?: string;
      images?: Array<{ url?: string }>;
    };

    if (submitData.images?.[0]?.url) {
      const imageUrl = submitData.images[0].url;
      const imgRes = await fetch(imageUrl);
      return {
        imageUrl,
        imageBuffer: Buffer.from(await imgRes.arrayBuffer()),
        metadata: { provider: this.id, model },
      };
    }

    const requestId = submitData.request_id;
    if (!requestId) throw new Error("fal.ai returned no request_id");

    for (let i = 0; i < 60; i++) {
      await new Promise((r) => setTimeout(r, 2000));
      const statusRes = await fetch(`${FAL_QUEUE}/${model}/requests/${requestId}/status`, {
        headers: { Authorization: `Key ${req.apiKey}` },
      });
      const status = (await statusRes.json()) as { status?: string };
      if (status.status === "COMPLETED") {
        const resultRes = await fetch(`${FAL_QUEUE}/${model}/requests/${requestId}`, {
          headers: { Authorization: `Key ${req.apiKey}` },
        });
        const result = (await resultRes.json()) as {
          images?: Array<{ url?: string }>;
        };
        const imageUrl = result.images?.[0]?.url;
        if (!imageUrl) throw new Error("fal.ai completed but no image");
        const imgRes = await fetch(imageUrl);
        return {
          imageUrl,
          imageBuffer: Buffer.from(await imgRes.arrayBuffer()),
          metadata: { provider: this.id, model, requestId },
        };
      }
      if (status.status === "FAILED") throw new Error("fal.ai generation failed");
    }

    throw new Error("fal.ai generation timed out");
  }

  async testConnection(apiKey: string): Promise<boolean> {
    const res = await fetch("https://rest.alpha.fal.ai/keys/current", {
      headers: { Authorization: `Key ${apiKey}` },
    });
    return res.ok;
  }
}
