import { cpSync, existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "../../..");
const desktopOutDir = resolve(repoRoot, "apps/desktop/out");

const syncTargets = [
  {
    name: "server config",
    from: resolve(repoRoot, "apps/server/config"),
    to: resolve(desktopOutDir, "config"),
  },
  {
    name: "mcp plugin assets",
    from: resolve(repoRoot, "packages/mcp-godot/dist/plugin"),
    to: resolve(desktopOutDir, "dist/plugin"),
  },
  {
    name: "mcp generated tools manifest",
    from: resolve(repoRoot, "packages/mcp-godot/dist/generated"),
    to: resolve(desktopOutDir, "dist/generated"),
  },
];

for (const target of syncTargets) {
  if (!existsSync(target.from)) {
    throw new Error(
      `Cannot sync ${target.name}: source directory not found at ${target.from}`
    );
  }

  mkdirSync(target.to, { recursive: true });
  cpSync(target.from, target.to, {
    recursive: true,
    force: true,
  });
  console.log(`Synced ${target.name}: ${target.from} -> ${target.to}`);
}
