import { readFileSync, readdirSync, writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(__dirname, "..");
const commandsDir = join(packageRoot, "plugin/commands");
const metaFile = join(commandsDir, "_tool_meta.json");
const outDir = join(__dirname, "../src/generated");
const outFile = join(outDir, "godot-pro-tools.json");

interface ToolExample {
  description?: string;
  arguments: Record<string, unknown>;
}

interface ToolDef {
  name: string;
  description: string;
  source: "plugin";
  inputSchema: Record<string, unknown>;
  category?: string;
  examples?: ToolExample[];
}

interface ParamMeta {
  description?: string;
  type?: string;
  enum?: unknown[];
  default?: unknown;
}

interface ToolMeta {
  category?: string;
  description?: string;
  examples?: ToolExample[];
  params?: Record<string, ParamMeta>;
}

function loadToolMeta(): Record<string, ToolMeta> {
  try {
    const raw = JSON.parse(readFileSync(metaFile, "utf-8")) as Record<string, ToolMeta>;
    delete (raw as Record<string, unknown>)["$comment"];
    return raw;
  } catch {
    return {};
  }
}

const toolMeta = loadToolMeta();

const COMMAND_PATTERN = /"([a-z][a-z0-9_]*)"\s*:\s*_/g;
const FUNC_PATTERN = /func\s+(_[a-z0-9_]+)\(params:\s*Dictionary\)\s*->\s*Dictionary:\n([\s\S]*?)(?=\nfunc\s+_[a-z0-9_]+\(|$)/g;
const MAP_PATTERN = /"([a-z][a-z0-9_]*)"\s*:\s*(_[a-z0-9_]+)/g;

interface ParamInfo {
  type: string;
  required: boolean;
  description?: string;
}

type HandlerMap = Map<string, Record<string, ParamInfo>>;

function stripConditionalGuards(body: string): string {
  return body
    .replace(/if params\.has\("([^"]+)"\):[\s\S]*?(?=\n\S|\n\t*func|\n$)/g, "")
    .replace(/if not [^\n]+:\n\t+return[^\n]*(?:\n\t+[^\n]*)*/g, (match) => match);
}

function extractToolsFromFile(filePath: string): string[] {
  const content = readFileSync(filePath, "utf-8");
  const names: string[] = [];
  let match: RegExpExecArray | null;
  const getCommandsBlock = content.match(/func get_commands\(\)[^{]*\{([^}]+(?:\{[^}]*\}[^}]*)*)\}/s);
  if (!getCommandsBlock) return names;

  const block = getCommandsBlock[1];
  while ((match = COMMAND_PATTERN.exec(block)) !== null) {
    names.push(match[1]);
  }
  return names;
}

function humanize(name: string): string {
  return name.replace(/_/g, " ");
}

/** Map handler name -> docstring built from the `##` comment lines directly above its `func`. */
function extractDocstrings(content: string): Map<string, string> {
  const docs = new Map<string, string>();
  const lines = content.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const fnMatch = lines[i].match(/^func\s+(_[a-z0-9_]+)\(params:\s*Dictionary\)/);
    if (!fnMatch) continue;
    const commentLines: string[] = [];
    let j = i - 1;
    while (j >= 0) {
      const trimmed = lines[j].trim();
      if (trimmed.startsWith("##")) {
        commentLines.unshift(trimmed.replace(/^##\s?/, "").trim());
        j--;
      } else if (trimmed === "" && commentLines.length === 0) {
        j--;
      } else {
        break;
      }
    }
    const doc = commentLines
      .filter((l) => l && !/^─+/.test(l) && !l.startsWith("───"))
      .join(" ")
      .trim();
    if (doc) docs.set(fnMatch[1], doc);
  }
  return docs;
}

function mergeParam(target: Record<string, ParamInfo>, name: string, next: ParamInfo) {
  const current = target[name];
  if (!current) {
    target[name] = next;
    return;
  }

  target[name] = {
    type: current.type === next.type ? current.type : "string",
    required: current.required || next.required,
    description: current.description ?? next.description,
  };
}

function inferType(raw: string): string {
  if (raw.includes("optional_int") || raw.includes("int(")) return "integer";
  if (raw.includes("optional_bool") || raw.includes("bool(")) return "boolean";
  if (raw.includes("float(")) return "number";
  if (raw.includes("Array")) return "array";
  if (raw.includes("Dictionary")) return "object";
  return "string";
}

function extractHandlerParams(content: string): HandlerMap {
  const handlers: HandlerMap = new Map();

  let funcMatch: RegExpExecArray | null;
  while ((funcMatch = FUNC_PATTERN.exec(content)) !== null) {
    const handlerName = funcMatch[1];
    const body = funcMatch[2];
    const unguardedBody = stripConditionalGuards(body);
    const params: Record<string, ParamInfo> = {};

    for (const match of body.matchAll(/require_string\(params,\s*"([^"]+)"\)/g)) {
      mergeParam(params, match[1], { type: "string", required: true });
    }

    for (const match of body.matchAll(/if not params\.has\("([^"]+)"\)\s+or\s+not params\["[^"]+"\]\s+is Array/g)) {
      mergeParam(params, match[1], { type: "array", required: true });
    }

    for (const match of body.matchAll(/if not params\.has\("([^"]+)"\)\s+or\s+not params\["[^"]+"\]\s+is Dictionary/g)) {
      mergeParam(params, match[1], { type: "object", required: true });
    }

    for (const match of body.matchAll(/if not params\.has\("([^"]+)"\)/g)) {
      mergeParam(params, match[1], { type: "string", required: true });
    }

    for (const match of body.matchAll(/optional_(string|int|bool)\(params,\s*"([^"]+)"/g)) {
      const type =
        match[1] === "int" ? "integer" :
        match[1] === "bool" ? "boolean" :
        "string";
      mergeParam(params, match[2], { type, required: false });
    }

    for (const match of body.matchAll(/params\.get\("([^"]+)",\s*([^)]+)\)/g)) {
      mergeParam(params, match[1], { type: inferType(match[2]), required: false });
    }

    for (const match of unguardedBody.matchAll(/(int|float|bool|str)\(params\["([^"]+)"\]\)/g)) {
      const type =
        match[1] === "int" ? "integer" :
        match[1] === "float" ? "number" :
        match[1] === "bool" ? "boolean" :
        "string";
      mergeParam(params, match[2], { type, required: true });
    }

    for (const match of unguardedBody.matchAll(/params\["([^"]+)"\]\s+is Array/g)) {
      mergeParam(params, match[1], { type: "array", required: true });
    }

    for (const match of unguardedBody.matchAll(/params\["([^"]+)"\]\s+is Dictionary/g)) {
      mergeParam(params, match[1], { type: "object", required: true });
    }

    for (const match of unguardedBody.matchAll(/params\["([^"]+)"\]/g)) {
      mergeParam(params, match[1], { type: "string", required: true });
    }

    handlers.set(handlerName, params);
  }

  return handlers;
}

function buildToolSchema(params: Record<string, ParamInfo>, meta?: ToolMeta) {
  const metaParams = meta?.params ?? {};
  // Union of auto-inferred params and any params declared only in the sidecar.
  const names = new Set<string>([...Object.keys(params), ...Object.keys(metaParams)]);
  const entries = [...names].sort((a, b) => a.localeCompare(b));

  const properties: Record<string, Record<string, unknown>> = {};
  for (const name of entries) {
    const info = params[name];
    const m = metaParams[name];
    const prop: Record<string, unknown> = {
      type: m?.type ?? info?.type ?? "string",
      description: m?.description ?? info?.description ?? `Parameter ${name}`,
    };
    if (m?.enum) prop.enum = m.enum;
    if (m?.default !== undefined) prop.default = m.default;
    properties[name] = prop;
  }

  const required = entries.filter((name) => params[name]?.required && metaParams[name]?.default === undefined);

  return {
    type: "object",
    additionalProperties: true,
    properties,
    required,
  };
}

const tools: ToolDef[] = [];
const files = readdirSync(commandsDir).filter((f) => f.endsWith("_commands.gd"));

for (const file of files) {
  const filePath = join(commandsDir, file);
  const content = readFileSync(filePath, "utf-8");
  const handlers = extractHandlerParams(content);
  const docstrings = extractDocstrings(content);
  const names = extractToolsFromFile(filePath);
  const commandMappings = new Map<string, string>();

  let mappingMatch: RegExpExecArray | null;
  while ((mappingMatch = MAP_PATTERN.exec(content)) !== null) {
    commandMappings.set(mappingMatch[1], mappingMatch[2]);
  }

  for (const name of names) {
    const handlerName = commandMappings.get(name);
    const params = handlerName ? handlers.get(handlerName) ?? {} : {};
    const meta = toolMeta[name];
    const docstring = handlerName ? docstrings.get(handlerName) : undefined;
    const description = meta?.description ?? docstring ?? `Godot MCP Pro: ${humanize(name)}`;

    const tool: ToolDef = {
      name,
      description,
      source: "plugin",
      inputSchema: buildToolSchema(params, meta),
    };
    if (meta?.category) tool.category = meta.category;
    if (meta?.examples) tool.examples = meta.examples;
    tools.push(tool);
  }
}

tools.sort((a, b) => a.name.localeCompare(b.name));

mkdirSync(outDir, { recursive: true });
writeFileSync(outFile, JSON.stringify(tools, null, 2));
console.log(`Generated ${tools.length} plugin tools -> ${outFile}`);
