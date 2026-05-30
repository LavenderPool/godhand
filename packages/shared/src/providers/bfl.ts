import type { ImageGenRequest, ImageGenResult, ImageProvider } from "../interfaces.js";

const BFL_BASE = "https://api.bfl.ai";
const POLL_INTERVAL_MS = 1000;
const MAX_POLL_ATTEMPTS = 120;

function clampBflDimension(value: number): number {
  const clamped = Math.min(1440, Math.max(256, value));
  return Math.round(clamped / 32) * 32;
}

function buildPrompt(req: ImageGenRequest): string {
  return req.style ? `${req.prompt}, ${req.style} style` : req.prompt;
}

function parseDimensions(size?: string): { width: number; height: number } {
  const [rawWidth, rawHeight] = (size ?? "1024x1024").split("x").map(Number);
  return {
    width: clampBflDimension(rawWidth),
    height: clampBflDimension(rawHeight),
  };
}

type BflAsyncResponse = {
  id?: string;
  polling_url?: string;
};

type BflPollResponse = {
  status?: string;
  result?: { sample?: string };
};

export class BflImageProvider implements ImageProvider {
  id = "bfl";
  name = "Black Forest Labs";
  models = ["flux-dev"];

  async generate(req: ImageGenRequest): Promise<ImageGenResult> {
    const model = req.model || "flux-dev";
    const { width, height } = parseDimensions(req.size);

    const submitRes = await fetch(`${BFL_BASE}/v1/${model}`, {
      method: "POST",
      headers: {
        accept: "application/json",
        "x-key": req.apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt: buildPrompt(req),
        width,
        height,
        output_format: "png",
      }),
    });

    if (!submitRes.ok) {
      const err = await submitRes.text();
      throw new Error(`BFL API error: ${submitRes.status} ${err}`);
    }

    const submitData = (await submitRes.json()) as BflAsyncResponse;
    const pollingUrl = submitData.polling_url;
    if (!pollingUrl) throw new Error("BFL API returned no polling_url");

    for (let i = 0; i < MAX_POLL_ATTEMPTS; i++) {
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));

      const pollRes = await fetch(pollingUrl, {
        headers: {
          accept: "application/json",
          "x-key": req.apiKey,
        },
      });

      if (!pollRes.ok) {
        const err = await pollRes.text();
        throw new Error(`BFL polling error: ${pollRes.status} ${err}`);
      }

      const pollData = (await pollRes.json()) as BflPollResponse;

      if (pollData.status === "Ready") {
        const imageUrl = pollData.result?.sample;
        if (!imageUrl) throw new Error("BFL completed but no image URL");

        const imgRes = await fetch(imageUrl);
        if (!imgRes.ok) throw new Error(`Failed to download BFL image: ${imgRes.status}`);

        return {
          imageUrl,
          imageBuffer: Buffer.from(await imgRes.arrayBuffer()),
          metadata: { provider: this.id, model, id: submitData.id },
        };
      }

      if (pollData.status === "Error" || pollData.status === "Failed") {
        throw new Error(`BFL generation failed: ${JSON.stringify(pollData)}`);
      }
    }

    throw new Error("BFL generation timed out");
  }

  async getCredits(apiKey: string): Promise<number> {
    const res = await fetch(`${BFL_BASE}/v1/credits`, {
      headers: {
        accept: "application/json",
        "x-key": apiKey,
      },
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`BFL credits error: ${res.status} ${err}`);
    }

    const data = (await res.json()) as { credits: number };
    return data.credits;
  }

  async testConnection(apiKey: string): Promise<boolean> {
    const res = await fetch(`${BFL_BASE}/v1/flux-dev`, {
      method: "POST",
      headers: {
        accept: "application/json",
        "x-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt: "test",
        width: 256,
        height: 256,
        output_format: "png",
      }),
    });

    if (res.status === 401 || res.status === 403) return false;
    if (!res.ok) return false;

    const data = (await res.json()) as BflAsyncResponse;
    return Boolean(data.polling_url);
  }
}
