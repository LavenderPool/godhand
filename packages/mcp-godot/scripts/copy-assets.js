import { copyFileSync, mkdirSync, readdirSync, statSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function copyDir(src, dest) {
  mkdirSync(dest, { recursive: true });
  for (const entry of readdirSync(src)) {
    const srcPath = join(src, entry);
    const destPath = join(dest, entry);
    if (statSync(srcPath).isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      copyFileSync(srcPath, destPath);
    }
  }
}

const srcGd = join(__dirname, "../cli-assets/godot_operations.gd");
const destGd = join(__dirname, "../dist/scripts/godot_operations.gd");
mkdirSync(dirname(destGd), { recursive: true });
copyFileSync(srcGd, destGd);

const srcGen = join(__dirname, "../src/generated");
const destGen = join(__dirname, "../dist/generated");
copyDir(srcGen, destGen);

const srcPlugin = join(__dirname, "../plugin");
const destPlugin = join(__dirname, "../dist/plugin");
copyDir(srcPlugin, destPlugin);

console.log("Copied MCP CLI assets, plugin assets, and generated tools manifest");
