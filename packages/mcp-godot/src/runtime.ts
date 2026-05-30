import { cpSync, existsSync, readFileSync, writeFileSync } from "fs";
import { dirname, join, resolve } from "path";
import { fileURLToPath } from "url";
import { WS_BASE_PORT } from "@godhand/shared";
import { buildProjectWsUrl } from "./ws-server.js";

const moduleDir = dirname(fileURLToPath(import.meta.url));

function resolveWsPort(wsPort?: number): number {
  return Number(wsPort ?? process.env.WS_PORT ?? WS_BASE_PORT);
}

export function getMcpPackageRoot(): string {
  return resolve(moduleDir, "..");
}

export function getMcpEntryPath(): string {
  return join(getMcpPackageRoot(), "dist", "index.js");
}

export function getPluginAssetsDir(): string {
  return join(getMcpPackageRoot(), "dist", "plugin");
}

export function getPluginConfigPath(): string {
  return join(getPluginAssetsDir(), "plugin.cfg");
}

export function getPluginVersion(): string | null {
  const configPath = getPluginConfigPath();
  if (!existsSync(configPath)) return null;

  const content = readFileSync(configPath, "utf-8");
  const match = content.match(/^version="([^"]+)"/m);
  return match?.[1] ?? null;
}

export function getCliAssetPath(fileName: string): string {
  return join(getMcpPackageRoot(), "dist", "scripts", fileName);
}

export function getGeneratedToolsManifestPath(): string {
  return join(moduleDir, "generated", "godot-pro-tools.json");
}

export const GODOT_MCP_PLUGIN_RES_PATH = "res://addons/godot_mcp/plugin.cfg";

export function getGodotMcpPluginInstallPath(projectPath: string): string {
  return join(projectPath, "addons", "godot_mcp");
}

export function isGodotMcpPluginInstalled(projectPath: string): boolean {
  return existsSync(join(getGodotMcpPluginInstallPath(projectPath), "plugin.cfg"));
}

function enableGodotMcpPluginInProjectFile(projectPath: string): void {
  const projectFile = join(projectPath, "project.godot");
  if (!existsSync(projectFile)) return;

  const content = readFileSync(projectFile, "utf-8");
  const pluginEntry = `"${GODOT_MCP_PLUGIN_RES_PATH}"`;

  if (!content.includes("[editor_plugins]")) {
    const suffix = content.endsWith("\n") ? "" : "\n";
    writeFileSync(
      projectFile,
      `${content}${suffix}\n[editor_plugins]\n\nenabled=PackedStringArray(${pluginEntry})\n`,
      "utf-8"
    );
    return;
  }

  const sectionMatch = content.match(/\[editor_plugins\][\s\S]*?(?=\n\[|$)/);
  if (!sectionMatch) return;

  const section = sectionMatch[0];
  if (section.includes(GODOT_MCP_PLUGIN_RES_PATH)) return;

  const enabledMatch = section.match(/^enabled=PackedStringArray\((.*)\)$/m);
  if (!enabledMatch) {
    const updatedSection = section.endsWith("\n")
      ? `${section}enabled=PackedStringArray(${pluginEntry})\n`
      : `${section}\nenabled=PackedStringArray(${pluginEntry})\n`;
    writeFileSync(projectFile, content.replace(section, updatedSection), "utf-8");
    return;
  }

  const entries = enabledMatch[1]?.trim();
  const nextEntries = entries ? `${entries}, ${pluginEntry}` : pluginEntry;
  const updatedSection = section.replace(
    enabledMatch[0],
    `enabled=PackedStringArray(${nextEntries})`
  );
  writeFileSync(projectFile, content.replace(section, updatedSection), "utf-8");
}

export function installGodotMcpPlugin(projectPath: string): { installed: boolean; pluginPath: string } {
  const pluginPath = getGodotMcpPluginInstallPath(projectPath);
  const sourceDir = getPluginAssetsDir();

  if (!existsSync(sourceDir)) {
    throw new Error(`MCP plugin assets not found at ${sourceDir}`);
  }

  cpSync(sourceDir, pluginPath, { recursive: true, force: true });
  enableGodotMcpPluginInProjectFile(projectPath);

  return { installed: true, pluginPath };
}

export function buildGodhandProjectConfig(projectId: string, wsPort?: number) {
  return {
    projectId,
    relayUrl: buildProjectWsUrl(projectId, resolveWsPort(wsPort)),
  };
}

export function buildCursorMcpServerConfig(options: {
  projectId: string;
  godotPath?: string;
  apiUrl?: string;
  wsPort?: number;
}) {
  const godhandApiUrl = options.apiUrl ?? process.env.GODHAND_API_URL ?? "http://127.0.0.1:3001/api/v1";
  const wsPort = resolveWsPort(options.wsPort);

  return {
    command: "node",
    args: [getMcpEntryPath()],
    env: {
      PROJECT_ID: options.projectId,
      GODOT_PATH: options.godotPath ?? process.env.GODOT_PATH ?? "",
      GODOT_PROJECT_PATH: "${workspaceFolder}",
      GODHAND_API_URL: godhandApiUrl,
      WS_RELAY_MODE: "remote",
      WS_PORT: String(wsPort),
    },
  };
}
