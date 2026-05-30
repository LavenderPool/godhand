import { readFileSync, readdirSync, existsSync } from "fs";
import { join } from "path";
import type { FileTreeNode, SkillCard } from "@godhand/shared";
import { getFileExtension } from "@godhand/shared";
import { getMcpPackageRoot, getPluginAssetsDir } from "@godhand/mcp-godot/lib";

export function buildFileTree(dirPath: string, basePath: string, maxDepth = 8, depth = 0): FileTreeNode[] {
  if (depth > maxDepth || !existsSync(dirPath)) return [];

  const entries = readdirSync(dirPath, { withFileTypes: true });
  const nodes: FileTreeNode[] = [];

  for (const entry of entries) {
    if (entry.name.startsWith(".") && entry.name !== ".godot") continue;

    const fullPath = join(dirPath, entry.name);
    const relPath = fullPath.replace(basePath, "").replace(/\\/g, "/") || "/";

    if (entry.isDirectory()) {
      nodes.push({
        name: entry.name,
        path: relPath,
        type: "directory",
        children: buildFileTree(fullPath, basePath, maxDepth, depth + 1),
      });
    } else {
      nodes.push({
        name: entry.name,
        path: relPath,
        type: "file",
        extension: getFileExtension(entry.name),
      });
    }
  }

  return nodes.sort((a, b) => {
    if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

export function parseSkillsFromMd(content: string, filePath: string): SkillCard[] {
  const cards: SkillCard[] = [];
  const lines = content.split("\n");
  let currentCategory = "general";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith("### ")) {
      currentCategory = line.replace("### ", "").trim();
    }
    if (line.startsWith("## ") && !line.startsWith("### ")) {
      const name = line.replace("## ", "").trim();
      const description = lines
        .slice(i + 1, i + 5)
        .filter((l) => l.trim() && !l.startsWith("#"))
        .join(" ")
        .slice(0, 200);

      cards.push({
        id: `${filePath}:${name}`.replace(/[^a-zA-Z0-9:_-]/g, "_"),
        name,
        description,
        category: currentCategory,
        filePath,
        enabled: false,
      });
    }
  }

  return cards;
}

export function loadSkillFiles(): SkillCard[] {
  const mcpPackageRoot = getMcpPackageRoot();
  const skillPaths = [
    join(getPluginAssetsDir(), "skills.md"),
    join(getPluginAssetsDir(), "skills.ru.md"),
    join(mcpPackageRoot, "skills"),
  ];

  const all: SkillCard[] = [];

  for (const p of skillPaths) {
    if (!existsSync(p)) continue;
    if (p.endsWith(".md")) {
      all.push(...parseSkillsFromMd(readFileSync(p, "utf-8"), p));
    } else {
      for (const file of readdirSync(p).filter((f) => f.endsWith(".md") || f.endsWith(".ts"))) {
        const fp = join(p, file);
        if (file.endsWith(".md")) {
          all.push(...parseSkillsFromMd(readFileSync(fp, "utf-8"), fp));
        } else {
          all.push({
            id: file.replace(".ts", ""),
            name: file.replace(".ts", ""),
            description: `TypeScript skill plugin: ${file}`,
            category: "plugin",
            filePath: fp,
            enabled: false,
          });
        }
      }
    }
  }

  return all;
}
