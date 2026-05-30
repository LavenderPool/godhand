import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import type { McpToolDefinition } from "@godhand/shared";
import { WS_BASE_PORT, CLI_TOOL_PREFIX, CLI_TOOLS_WITH_PREFIX } from "@godhand/shared";
import {
  sharedWsRelay,
  HttpRelayClient,
  type ProjectRelay,
} from "./ws-server.js";
import { GodotCliService, getCliToolDefinitions } from "./cli-tools/godot-cli.js";
import { getGeneratedToolsManifestPath, getPluginAssetsDir, getPluginVersion } from "./runtime.js";
import { GUIDE_TOPICS, getAllGuides, getGuide, getBuiltinTools, callBuiltinTool } from "./guides.js";

function loadPluginTools(): McpToolDefinition[] {
  const manifest = getGeneratedToolsManifestPath();
  try {
    return JSON.parse(readFileSync(manifest, "utf-8")) as McpToolDefinition[];
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[mcp-godot] Failed to load plugin tools manifest at ${manifest}: ${message}`);
    return [];
  }
}

export interface McpGodotServerOptions {
  projectId?: string;
  wsPort?: number;
  godotPath?: string;
  apiUrl?: string;
  relayMode?: "local" | "remote";
}

function createProjectRelay(options: McpGodotServerOptions): ProjectRelay {
  const projectId = options.projectId ?? process.env.PROJECT_ID ?? "";
  if (!projectId) {
    throw new Error("PROJECT_ID is required for MCP Godot server");
  }

  const relayMode = options.relayMode ?? (process.env.WS_RELAY_MODE as "local" | "remote" | undefined);
  const apiUrl = options.apiUrl ?? process.env.GODHAND_API_URL;

  if (relayMode === "remote" || apiUrl) {
    if (!apiUrl) {
      throw new Error("GODHAND_API_URL is required when WS_RELAY_MODE=remote");
    }
    return new HttpRelayClient(apiUrl, projectId);
  }

  const port = options.wsPort ?? Number(process.env.WS_PORT ?? WS_BASE_PORT);
  sharedWsRelay.start();
  if (port !== sharedWsRelay.port) {
    console.warn(`WS relay uses shared port ${sharedWsRelay.port}, ignoring WS_PORT=${port}`);
  }
  return sharedWsRelay.forProject(projectId);
}

export class McpGodotServer {
  private server: Server;
  private projectRelay: ProjectRelay;
  private cli: GodotCliService;
  private pluginTools: McpToolDefinition[];
  private cliTools: McpToolDefinition[];
  private builtinTools: McpToolDefinition[];
  readonly projectId: string;

  constructor(private options: McpGodotServerOptions = {}) {
    this.projectId = options.projectId ?? process.env.PROJECT_ID ?? "";
    if (!this.projectId) {
      throw new Error("PROJECT_ID is required");
    }

    this.projectRelay = createProjectRelay(options);
    this.cli = new GodotCliService({ godotPath: options.godotPath });
    this.pluginTools = loadPluginTools();
    this.cliTools = getCliToolDefinitions();
    this.builtinTools = getBuiltinTools();

    if (this.pluginTools.length === 0) {
      console.error(
        "[mcp-godot] No plugin tools loaded - only CLI/builtin tools will be available. Rebuild @godhand/mcp-godot."
      );
    }

    this.server = new Server(
      { name: "godhand-godot", version: "0.1.0" },
      { capabilities: { tools: {}, resources: {}, prompts: {} } }
    );

    this.setupHandlers();
  }

  getProjectRelay(): ProjectRelay {
    return this.projectRelay;
  }

  /** @deprecated Use getProjectRelay() */
  getWsRelay(): ProjectRelay {
    return this.projectRelay;
  }

  getAllTools(): McpToolDefinition[] {
    return [...this.builtinTools, ...this.pluginTools, ...this.cliTools];
  }

  getStatus() {
    return {
      connected: this.projectRelay.isConnected(),
      projectId: this.projectId,
      wsPort: sharedWsRelay.port,
      relayUrl: `ws://127.0.0.1:${sharedWsRelay.port}/ws/${this.projectId}`,
      pluginVersion: getPluginVersion(),
      connectedProjectIds: sharedWsRelay.getConnectedProjectIds(),
      toolCount: this.getAllTools().length,
    };
  }

  async callTool(name: string, args: Record<string, unknown> = {}) {
    const allTools = this.getAllTools();
    let tool = allTools.find((t) => t.name === name);

    if (!tool && CLI_TOOLS_WITH_PREFIX.has(name)) {
      const aliased = `${CLI_TOOL_PREFIX}${name}`;
      tool = allTools.find((t) => t.name === aliased);
      if (tool) name = aliased;
    }

    if (!tool) {
      throw new Error(`Unknown tool: ${name}`);
    }

    if (tool.source === "builtin") {
      return callBuiltinTool(name, args);
    }

    if (tool.source === "cli") {
      return this.cli.callTool(name, args);
    }

    if (this.projectRelay instanceof HttpRelayClient) {
      await this.projectRelay.refreshStatus();
    }

    if (
      tool.source === "plugin" &&
      !this.projectRelay.isConnected() &&
      CLI_TOOLS_WITH_PREFIX.has(name)
    ) {
      return this.cli.callTool(`${CLI_TOOL_PREFIX}${name}`, args);
    }

    const result = await this.projectRelay.call(name, args);
    return { result };
  }

  private buildToolDescription(t: McpToolDefinition): string {
    const tag = t.category ? `[${t.source.toUpperCase()}/${t.category}]` : `[${t.source.toUpperCase()}]`;
    let description = `${tag} ${t.description}`;
    const example = t.examples?.[0];
    if (example) {
      const label = example.description ? `${example.description}: ` : "";
      description += `\nExample - ${label}${JSON.stringify(example.arguments)}`;
    }
    return description;
  }

  private setupHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: this.getAllTools().map((t) => ({
        name: t.name,
        description: this.buildToolDescription(t),
        inputSchema: t.inputSchema,
      })),
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      const result = await this.callTool(name, (args ?? {}) as Record<string, unknown>);
      const text = "result" in result
        ? JSON.stringify(result.result, null, 2)
        : JSON.stringify(result, null, 2);
      return {
        content: [{ type: "text", text }],
      };
    });

    this.setupResourceHandlers();
    this.setupPromptHandlers();
  }

  private setupResourceHandlers() {
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => {
      const guideResources = GUIDE_TOPICS.map((topic) => ({
        uri: `godot-guide://${topic}`,
        name: `Godot guide: ${topic}`,
        description: `Workflow guidance for "${topic}"`,
        mimeType: "text/markdown",
      }));

      const skillResources: Array<{ uri: string; name: string; description: string; mimeType: string }> = [];
      const pluginDir = getPluginAssetsDir();
      for (const file of ["skills.md", "skills.ru.md"]) {
        if (existsSync(join(pluginDir, file))) {
          skillResources.push({
            uri: `godot-skills://${file}`,
            name: `Godot skills (${file})`,
            description: "Full Godot MCP skills reference",
            mimeType: "text/markdown",
          });
        }
      }

      return { resources: [...guideResources, ...skillResources] };
    });

    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      const uri = request.params.uri;

      if (uri.startsWith("godot-guide://")) {
        const topic = uri.slice("godot-guide://".length);
        return {
          contents: [{ uri, mimeType: "text/markdown", text: getGuide(topic) }],
        };
      }

      if (uri.startsWith("godot-skills://")) {
        const file = uri.slice("godot-skills://".length);
        const path = join(getPluginAssetsDir(), file);
        if (!file.startsWith("skills.") || !existsSync(path)) {
          throw new Error(`Unknown skills resource: ${uri}`);
        }
        return {
          contents: [{ uri, mimeType: "text/markdown", text: readFileSync(path, "utf-8") }],
        };
      }

      throw new Error(`Unknown resource: ${uri}`);
    });
  }

  private setupPromptHandlers() {
    const prompts = [
      {
        name: "build-2d-mobile-game",
        description: "Build an optimized 2D platformer playable on Android/iOS from scratch.",
        text:
          "Build a polished 2D platformer in this Godot project, optimized for phones. " +
          "First call get_godot_guide with topic 'quickstart-2d' and then 'mobile'. " +
          "Then: apply_mobile_preset, set up input actions, setup_2d_platformer_player, " +
          "build a tilemap world with create_tileset, add parallax + 2D lighting, particles for juice, " +
          "setup_touch_controls, apply_safe_area on the HUD, playtest with play_scene, run optimize_for_mobile, " +
          "and finish with deploy_to_android.",
      },
      {
        name: "build-3d-mobile-game",
        description: "Build an optimized 3D third-person game playable on phones from scratch.",
        text:
          "Build a small 3D third-person game in this Godot project, optimized for phones. " +
          "First call get_godot_guide with topic 'quickstart-3d' and then 'mobile'. " +
          "Then: apply_mobile_preset (mobile renderer), setup_3d_character, block out a level with setup_csg, " +
          "setup_lighting preset 'sun' + setup_environment, use add_multimesh for repeated props, " +
          "setup_touch_controls, playtest, run optimize_for_mobile, then export_ios or deploy_to_android.",
      },
    ];

    this.server.setRequestHandler(ListPromptsRequestSchema, async () => ({
      prompts: prompts.map((p) => ({ name: p.name, description: p.description })),
    }));

    this.server.setRequestHandler(GetPromptRequestSchema, async (request) => {
      const prompt = prompts.find((p) => p.name === request.params.name);
      if (!prompt) {
        throw new Error(`Unknown prompt: ${request.params.name}`);
      }
      return {
        description: prompt.description,
        messages: [
          {
            role: "user" as const,
            content: { type: "text" as const, text: prompt.text },
          },
        ],
      };
    });
  }

  async startStdio(): Promise<void> {
    if (this.projectRelay instanceof HttpRelayClient) {
      await this.projectRelay.refreshStatus();
    }
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
  }

  stop(): void {
    /* shared relay lifecycle managed by backend */
  }
}

export async function createMcpGodotServer(options?: McpGodotServerOptions) {
  return new McpGodotServer(options);
}
