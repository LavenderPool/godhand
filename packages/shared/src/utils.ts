export function maskApiKey(key: string): string {
  if (!key || key.length < 8) return "****";
  return `${key.slice(0, 4)}...${key.slice(-4)}`;
}

export function parseJsonSafe<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function now(): number {
  return Date.now();
}

export function getFileExtension(filename: string): string {
  const idx = filename.lastIndexOf(".");
  return idx >= 0 ? filename.slice(idx + 1).toLowerCase() : "";
}

export function isImageExtension(ext: string): boolean {
  return ["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp"].includes(ext);
}

export function isGodotExtension(ext: string): boolean {
  return ["gd", "tscn", "tres", "godot", "import", "gdshader", "cs"].includes(ext);
}
