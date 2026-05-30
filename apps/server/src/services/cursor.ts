import { join, dirname } from "path";

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";

import { fileURLToPath } from "url";
import { WS_BASE_PORT } from "@godhand/shared";
import {
  buildCursorMcpServerConfig as buildCursorMcpServerConfigFromLib,
} from "@godhand/mcp-godot/lib";



const __dirname = dirname(fileURLToPath(import.meta.url));

const RULES_FILE_NAME = "ai-mcp-neural-best-practices.mdc";

const ALWAYS_APPLY_RULE_CONTENT = `---
description: MCP and neural coding best practices
alwaysApply: true
---

# MCP And Neural Coding Best Practices

## MCP Usage
- Use MCP tools only when they are the best fit for the requested task.
- Read the tool descriptor/schema before every call.
- Pass only validated arguments that match the schema types and required fields.
- Prefer scoped queries and minimal payloads to reduce noise and failures.
- If a tool needs auth and fails with auth errors, authenticate once and retry.
- If MCP cannot cover part of the task, state the gap clearly and continue with available tools.

## Neural Coding Best Practices
- Clarify objective, constraints, and acceptance criteria before implementing.
- Break work into small, testable changes; avoid large mixed refactors.
- Keep experiments reproducible: fixed seeds, explicit configs, pinned dependencies.
- Add observability for key paths: structured logs, metrics, and error context.
- Validate behavior with representative test cases, including edge and failure paths.
- Optimize after correctness; document trade-offs for model quality, latency, and cost.
- Never invent APIs, files, or metrics; verify from code or trusted sources first.

## Pre-Change Checklist
- Confirm task scope and expected outputs.
- Locate source-of-truth files and existing patterns.
- Identify risks, rollback path, and required tests.
- Ensure any MCP call is schema-checked first.

## Pre-Finalization Checklist
- Re-run or verify relevant tests and linters for touched code.
- Confirm no unrelated files were changed.
- Summarize what changed, why, and remaining risks.
- Call out any assumptions, unresolved blockers, or follow-up tasks.

## Godot MCP Workflow
- This project is wired to the Godot MCP server (tools prefixed by their source, e.g. [PLUGIN], [CLI], [BUILTIN]).
- Before building anything, call \`get_godot_guide\` (topic "overview", then "quickstart-2d"/"quickstart-3d"/"mobile"). MCP also exposes guide/skills resources and ready-made prompts.
- Always start by calling \`get_project_info\` and \`get_filesystem_tree\`. Open or create a scene before editing nodes. Call \`save_scene\` after editing scenes. All changes go through Godot UndoRedo.
- Most tools are [PLUGIN] tools that require the Godot editor to be open with the GodHand plugin connected. A few tools (\`get_project_info\`, \`create_scene\`, \`save_scene\`) also have a CLI variant exposed as \`cli_*\` that works without the editor; if you call the bare name while the editor is closed, the server automatically falls back to the CLI variant.
- Property values use Godot literals: \`Vector2(x, y)\`, \`Color(r,g,b,a)\`, \`true\`, numbers, or \`res://\` paths.
- Prefer high-level builders to scaffold playable games fast: \`setup_2d_platformer_player\`, \`setup_3d_character\`, \`apply_mobile_preset\`, \`setup_touch_controls\`; then refine with granular tools and playtest via \`play_scene\` + \`get_game_screenshot\`.
- Targeting phones: run \`apply_mobile_preset\` early, add \`setup_touch_controls\` + \`apply_safe_area\`, and finish with \`optimize_for_mobile\` and \`deploy_to_android\`/\`export_ios\`.
`;



export function getCursorConfigPath(projectPath: string): string {

  return join(projectPath, ".cursor", "mcp.json");

}

export function getCursorRulesPath(projectPath: string): string {
  return join(projectPath, ".cursor", "rules", RULES_FILE_NAME);
}

function writeAlwaysApplyRule(projectPath: string): string {
  const rulesPath = getCursorRulesPath(projectPath);
  mkdirSync(dirname(rulesPath), { recursive: true });
  writeFileSync(rulesPath, ALWAYS_APPLY_RULE_CONTENT, "utf-8");
  return rulesPath;
}

function buildRelayUrl(projectId: string): string {
  return `ws://127.0.0.1:${Number(process.env.WS_PORT ?? WS_BASE_PORT)}/ws/${encodeURIComponent(projectId)}`;
}

function buildCursorMcpServerConfig(options: {
  projectId: string;
  projectPath: string;
  godotPath?: string;
  apiUrl?: string;
}) {
  const baseConfig = buildCursorMcpServerConfigFromLib({
    projectId: options.projectId,
    godotPath: options.godotPath,
    apiUrl: options.apiUrl,
    wsPort: Number(process.env.WS_PORT ?? WS_BASE_PORT),
  });
  return {
    ...baseConfig,
    env: {
      ...baseConfig.env,
      GODOT_PROJECT_PATH: options.projectPath,
      GODHAND_PROJECT_PATH: options.projectPath,
    },
  };
}



export function connectCursorMcp(

  projectId: string,

  projectPath: string,

  godotPath?: string,

  apiUrl?: string

) {

  const configPath = getCursorConfigPath(projectPath);
  const relayUrl = buildRelayUrl(projectId);

  const godhandApiUrl = apiUrl ?? process.env.GODHAND_API_URL ?? "http://127.0.0.1:3001/api/v1";



  let config: { mcpServers?: Record<string, unknown> } = {};

  if (existsSync(configPath)) {

    config = JSON.parse(readFileSync(configPath, "utf-8"));

  }



  config.mcpServers ??= {};

  const serverConfig = buildCursorMcpServerConfig({
    projectId,
    projectPath,
    godotPath,
    apiUrl: godhandApiUrl,
  });
  const mcpEntryPath =
    Array.isArray(serverConfig.args) && typeof serverConfig.args[0] === "string"
      ? serverConfig.args[0]
      : "";
  if (!mcpEntryPath || !existsSync(mcpEntryPath)) {
    throw new Error(
      `MCP server entry not found at ${mcpEntryPath || "<empty>"}. Rebuild @godhand/mcp-godot and try again.`
    );
  }

  config.mcpServers["godhand-godot"] = serverConfig;



  mkdirSync(dirname(configPath), { recursive: true });

  writeFileSync(configPath, JSON.stringify(config, null, 2));
  const rulesPath = writeAlwaysApplyRule(projectPath);



  return { configPath, rulesPath, mcpEntryPath, relayUrl };

}

