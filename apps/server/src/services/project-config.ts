import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import {
  buildGodhandProjectConfig,
  installGodotMcpPlugin,
  isGodotMcpPluginInstalled,
} from "@godhand/mcp-godot/lib";
import { connectCursorMcp } from "./cursor.js";
import { resolveGodotPathInfo } from "./mcp.js";

export function writeGodhandProjectConfig(projectId: string, projectPath: string) {
  const config = buildGodhandProjectConfig(projectId);
  const configDir = join(projectPath, ".godhand");
  mkdirSync(configDir, { recursive: true });
  writeFileSync(
    join(configDir, "project.json"),
    JSON.stringify(config, null, 2),
    "utf-8"
  );
  return config.relayUrl;
}

export function setupGodhandProject(projectId: string, projectPath: string) {
  const relayUrl = writeGodhandProjectConfig(projectId, projectPath);
  installGodotMcpPlugin(projectPath);
  return {
    relayUrl,
    pluginInstalled: isGodotMcpPluginInstalled(projectPath),
  };
}

export async function ensureProjectRuntimeConfig(
  projectId: string,
  projectPath: string,
  apiUrl?: string
) {
  const godot = await resolveGodotPathInfo();
  const projectSetup = setupGodhandProject(projectId, projectPath);
  const cursorSetup = connectCursorMcp(projectId, projectPath, godot.path, apiUrl);
  const pluginPath = join(projectPath, "addons", "godot_mcp");

  return {
    ...projectSetup,
    ...cursorSetup,
    pluginPath,
    godotPath: godot.path ?? "",
    detectedFrom: godot.source,
    env: {
      PROJECT_ID: projectId,
      GODOT_PATH: godot.path ?? "",
      GODOT_PROJECT_PATH: projectPath,
      GODHAND_PROJECT_PATH: projectPath,
      GODHAND_API_URL: apiUrl ?? process.env.GODHAND_API_URL ?? "http://127.0.0.1:3001/api/v1",
      WS_RELAY_MODE: "remote",
      WS_PORT: String(process.env.WS_PORT ?? 6505),
    },
  };
}
