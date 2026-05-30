import { existsSync, readdirSync, readFileSync } from "fs";
import { join, normalize } from "path";
import { execa } from "execa";
import { CLI_TOOL_PREFIX, CLI_TOOLS_WITH_PREFIX } from "@godhand/shared";
import type { McpToolDefinition } from "@godhand/shared";
import { getCliAssetPath } from "../runtime.js";
import { detectGodotExecutable } from "../godot-detect.js";

export interface GodotCliConfig {
  godotPath?: string;
}

interface GodotProcess {
  process: ReturnType<typeof execa>;
  output: string[];
  errors: string[];
}

const CLI_TOOL_DEFS: Array<{
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}> = [
  {
    name: "launch_editor",
    description: "Launch Godot editor for a specific project",
    inputSchema: {
      type: "object",
      properties: { projectPath: { type: "string" } },
      required: ["projectPath"],
    },
  },
  {
    name: "run_project",
    description: "Run the Godot project and capture output",
    inputSchema: {
      type: "object",
      properties: {
        projectPath: { type: "string" },
        scene: { type: "string" },
      },
      required: ["projectPath"],
    },
  },
  {
    name: "get_debug_output",
    description: "Get the current debug output and errors",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "stop_project",
    description: "Stop the currently running Godot project",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "get_godot_version",
    description: "Get the installed Godot version",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "list_projects",
    description: "List Godot projects in a directory",
    inputSchema: {
      type: "object",
      properties: {
        directory: { type: "string" },
        recursive: { type: "boolean" },
      },
      required: ["directory"],
    },
  },
  {
    name: "get_project_info",
    description: "Retrieve metadata about a Godot project (CLI)",
    inputSchema: {
      type: "object",
      properties: { projectPath: { type: "string" } },
      required: ["projectPath"],
    },
  },
  {
    name: "create_scene",
    description: "Create a new Godot scene file (CLI)",
    inputSchema: {
      type: "object",
      properties: {
        projectPath: { type: "string" },
        scenePath: { type: "string" },
        rootNodeType: { type: "string" },
      },
      required: ["projectPath", "scenePath"],
    },
  },
  {
    name: "add_node",
    description: "Add a node to an existing scene",
    inputSchema: {
      type: "object",
      properties: {
        projectPath: { type: "string" },
        scenePath: { type: "string" },
        parentNodePath: { type: "string" },
        nodeType: { type: "string" },
        nodeName: { type: "string" },
        properties: { type: "object" },
      },
      required: ["projectPath", "scenePath", "nodeType", "nodeName"],
    },
  },
  {
    name: "load_sprite",
    description: "Load a sprite into a Sprite2D node",
    inputSchema: {
      type: "object",
      properties: {
        projectPath: { type: "string" },
        scenePath: { type: "string" },
        nodePath: { type: "string" },
        texturePath: { type: "string" },
      },
      required: ["projectPath", "scenePath", "nodePath", "texturePath"],
    },
  },
  {
    name: "export_mesh_library",
    description: "Export a scene as a MeshLibrary resource",
    inputSchema: {
      type: "object",
      properties: {
        projectPath: { type: "string" },
        scenePath: { type: "string" },
        outputPath: { type: "string" },
        meshItemNames: { type: "array", items: { type: "string" } },
      },
      required: ["projectPath", "scenePath", "outputPath"],
    },
  },
  {
    name: "save_scene",
    description: "Save changes to a scene file (CLI)",
    inputSchema: {
      type: "object",
      properties: {
        projectPath: { type: "string" },
        scenePath: { type: "string" },
        newPath: { type: "string" },
      },
      required: ["projectPath", "scenePath"],
    },
  },
  {
    name: "get_uid",
    description: "Get the UID for a specific file in a Godot project",
    inputSchema: {
      type: "object",
      properties: {
        projectPath: { type: "string" },
        filePath: { type: "string" },
      },
      required: ["projectPath", "filePath"],
    },
  },
  {
    name: "update_project_uids",
    description: "Update UID references in a Godot project",
    inputSchema: {
      type: "object",
      properties: { projectPath: { type: "string" } },
      required: ["projectPath"],
    },
  },
];

export function getCliMcpToolName(originalName: string): string {
  return CLI_TOOLS_WITH_PREFIX.has(originalName)
    ? `${CLI_TOOL_PREFIX}${originalName}`
    : originalName;
}

export function getCliToolDefinitions(): McpToolDefinition[] {
  return CLI_TOOL_DEFS.map((t) => ({
    name: getCliMcpToolName(t.name),
    description: t.description,
    source: "cli" as const,
    inputSchema: t.inputSchema,
  }));
}

export class GodotCliService {
  private godotPath: string | null = null;
  private activeProcess: GodotProcess | null = null;
  private operationsScript: string;

  constructor(private config: GodotCliConfig = {}) {
    this.operationsScript = getCliAssetPath("godot_operations.gd");
    if (config.godotPath) {
      this.godotPath = normalize(config.godotPath);
    }
  }

  async detectGodotPath(): Promise<string> {
    const detected = await detectGodotExecutable(this.godotPath ?? undefined);
    if (!detected) {
      throw new Error("Godot executable not found. Set GODOT_PATH.");
    }
    this.godotPath = detected;
    return detected;
  }

  async callTool(name: string, args: Record<string, unknown> = {}): Promise<{ content: Array<{ type: string; text: string }> }> {
    const originalName = name.startsWith(CLI_TOOL_PREFIX)
      ? name.slice(CLI_TOOL_PREFIX.length)
      : name;

    const godot = await this.detectGodotPath();

    switch (originalName) {
      case "launch_editor":
        return this.launchEditor(godot, args);
      case "run_project":
        return this.runProject(godot, args);
      case "get_debug_output":
        return this.textResult(
          JSON.stringify({
            output: this.activeProcess?.output ?? [],
            errors: this.activeProcess?.errors ?? [],
          })
        );
      case "stop_project":
        if (this.activeProcess) {
          this.activeProcess.process.kill();
          this.activeProcess = null;
        }
        return this.textResult("Project stopped");
      case "get_godot_version": {
        const { stdout } = await execa(godot, ["--version"]);
        return this.textResult(stdout.trim());
      }
      case "list_projects":
        return this.listProjects(args);
      case "get_project_info":
        return this.getProjectInfo(args);
      case "create_scene":
      case "add_node":
      case "load_sprite":
      case "export_mesh_library":
      case "save_scene":
      case "get_uid":
      case "update_project_uids":
        return this.runGodotOperation(godot, originalName, args);
      default:
        throw new Error(`Unknown CLI tool: ${name}`);
    }
  }

  private async launchEditor(godot: string, args: Record<string, unknown>) {
    const projectPath = String(args.projectPath ?? "");
    this.validateProject(projectPath);
    execa(godot, ["-e", "--path", projectPath], { detached: true, stdio: "ignore" });
    return this.textResult(`Godot editor launched for ${projectPath}`);
  }

  private async runProject(godot: string, args: Record<string, unknown>) {
    const projectPath = String(args.projectPath ?? "");
    this.validateProject(projectPath);

    if (this.activeProcess) {
      this.activeProcess.process.kill();
    }

    const cmdArgs = ["-d", "--path", projectPath];
    if (args.scene) cmdArgs.push(String(args.scene));

    const proc = execa(godot, cmdArgs);
    const state: GodotProcess = { process: proc, output: [], errors: [] };

    proc.stdout?.on("data", (d: Buffer) => state.output.push(d.toString()));
    proc.stderr?.on("data", (d: Buffer) => state.errors.push(d.toString()));
    proc.on("exit", () => {
      if (this.activeProcess === state) this.activeProcess = null;
    });

    this.activeProcess = state;
    return this.textResult(`Project running: ${projectPath}`);
  }

  private async listProjects(args: Record<string, unknown>) {
    const directory = String(args.directory ?? "");
    const recursive = Boolean(args.recursive);
    const projects: string[] = [];

    const scan = (dir: string, depth: number) => {
      if (!existsSync(dir)) return;
      if (existsSync(join(dir, "project.godot"))) {
        projects.push(dir);
        if (!recursive) return;
      }
      if (!recursive || depth > 5) return;
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (entry.isDirectory() && !entry.name.startsWith(".")) {
          scan(join(dir, entry.name), depth + 1);
        }
      }
    };

    scan(directory, 0);
    return this.textResult(JSON.stringify(projects, null, 2));
  }

  private async getProjectInfo(args: Record<string, unknown>) {
    const projectPath = String(args.projectPath ?? "");
    this.validateProject(projectPath);
    const content = readFileSync(join(projectPath, "project.godot"), "utf-8");
    const nameMatch = content.match(/config\/name="([^"]+)"/);
    return this.textResult(
      JSON.stringify({
        projectPath,
        name: nameMatch?.[1] ?? "Unknown",
        hasProjectFile: true,
      })
    );
  }

  private async runGodotOperation(godot: string, operation: string, args: Record<string, unknown>) {
    const projectPath = String(args.projectPath ?? process.env.GODOT_PROJECT_PATH ?? "");
    if (!projectPath) throw new Error("projectPath is required");

    const params = { operation, ...args };
    const { stdout, stderr } = await execa(godot, [
      "--headless",
      "--path",
      projectPath,
      "--script",
      this.operationsScript,
      JSON.stringify(params),
    ]);

    if (stderr && stderr.includes("ERROR")) {
      throw new Error(stderr);
    }

    return this.textResult(stdout || "Operation completed");
  }

  private validateProject(projectPath: string) {
    if (!projectPath || projectPath.includes("..")) {
      throw new Error("Invalid project path");
    }
    if (!existsSync(join(projectPath, "project.godot"))) {
      throw new Error(`Not a Godot project: ${projectPath}`);
    }
  }

  private textResult(text: string) {
    return { content: [{ type: "text", text }] };
  }
}
