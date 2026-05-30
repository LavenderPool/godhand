import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { v4 as uuid } from "uuid";
import { eq } from "drizzle-orm";
import type { Db } from "@godhand/db";
import { generations } from "@godhand/db";
import { getImageProvider, parseJsonSafe } from "@godhand/shared";
import type { ImageSize, ImageStyle } from "@godhand/shared";
import { emitEvent } from "../events.js";

export interface GenerateOptions {
  db: Db;
  projectId: string;
  projectPath: string;
  prompt: string;
  provider: string;
  model: string;
  size?: ImageSize;
  style?: ImageStyle;
  apiKey: string;
}

export async function generateSprite(opts: GenerateOptions) {
  const provider = getImageProvider(opts.provider);
  if (!provider) throw new Error(`Unknown provider: ${opts.provider}`);

  const result = await provider.generate({
    prompt: opts.prompt,
    model: opts.model,
    size: opts.size,
    style: opts.style,
    apiKey: opts.apiKey,
  });

  const genDir = join(opts.projectPath, ".godhand", "generations");
  mkdirSync(genDir, { recursive: true });

  const id = uuid();
  const imagePath = join(genDir, `${id}.png`);

  if (result.imageBuffer) {
    writeFileSync(imagePath, result.imageBuffer);
  } else if (result.imageBase64) {
    writeFileSync(imagePath, Buffer.from(result.imageBase64, "base64"));
  } else if (result.imageUrl) {
    const res = await fetch(result.imageUrl);
    writeFileSync(imagePath, Buffer.from(await res.arrayBuffer()));
  } else {
    throw new Error("No image data returned");
  }

  const metadata = JSON.stringify({
    provider: opts.provider,
    style: opts.style,
    size: opts.size,
    revisedPrompt: result.revisedPrompt,
    ...parseJsonSafe(JSON.stringify(result.metadata ?? {}), {}),
  });

  const now = Date.now();
  await opts.db.insert(generations).values({
    id,
    projectId: opts.projectId,
    prompt: opts.prompt,
    imagePath,
    model: opts.model,
    metadata,
    createdAt: now,
  });

  emitEvent("generation:complete", { id, projectId: opts.projectId, imagePath });

  return { id, imagePath, prompt: opts.prompt, model: opts.model, metadata, createdAt: now };
}

export async function getGenerations(db: Db, projectId: string) {
  return db.select().from(generations).where(eq(generations.projectId, projectId));
}
