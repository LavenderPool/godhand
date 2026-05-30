import { app, nativeImage } from "electron";
import { join } from "path";

export interface DesktopPaths {
  dbPath: string;
  webDist: string;
  migrationsFolder: string;
}

export function getDesktopPaths(): DesktopPaths {
  const userData = app.getPath("userData");

  if (app.isPackaged) {
    return {
      dbPath: join(userData, "data", "godhand.db"),
      webDist: join(process.resourcesPath, "web", "dist"),
      migrationsFolder: join(process.resourcesPath, "db", "drizzle"),
    };
  }

  const monorepoRoot = join(app.getAppPath(), "..", "..");
  return {
    dbPath: join(userData, "data", "godhand.db"),
    webDist: join(monorepoRoot, "apps", "web", "dist"),
    migrationsFolder: join(monorepoRoot, "packages", "db", "drizzle"),
  };
}

const FALLBACK_ICON =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAA2klEQVR4Ae3WMQ0AAAgDINc/9K3hYw0k0BNp5QEEEGCAAQYYYIABBhhggAEGGGCAAQYYYIABBhhggAEGGGCAAQYYYIABBhhggAEGGGCAAQYYYIABBhhggAEGGGCAAQYYYIABBhhggAEGGGCAAQYYYIABBhhggAEGGGCAAQYYYIABBhhggAEGGGCAAQYYYIABBhhggAEGGGCAAQYYYIABBhhggAEGGGCAAQYYYIABBhhggAEGGGCAAQYYYIABBhhggAEGGGCAAQYYYIABBhhggAEGGGCAAQYYYIABBhhggAEGGGCAAQYYYIABBhhggAEGGGCAAQYY+AN8FwABwQqH7QAAAABJRU5ErkJggg==";

export function loadAppIcon(): Electron.NativeImage {
  const candidates = app.isPackaged
    ? [join(process.resourcesPath, "icon.png")]
    : [join(app.getAppPath(), "resources", "icon.png")];

  for (const p of candidates) {
    const img = nativeImage.createFromPath(p);
    if (!img.isEmpty()) return img;
  }
  return nativeImage.createFromDataURL(FALLBACK_ICON);
}
