import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { subscribeEvents, type McpStatus, type McpToolDefinition } from "@/lib/api";

function formatMcpError(message: string, t: (key: string) => string): string {
  if (message.includes("No Godot plugin connected")) {
    return t("mcp.pluginNotConnectedError");
  }
  if (message.includes("Godot executable not found")) {
    return t("mcp.godotPathRequired");
  }
  try {
    const parsed = JSON.parse(message) as { error?: string };
    if (parsed.error?.includes("No Godot plugin connected")) {
      return t("mcp.pluginNotConnectedError");
    }
    if (parsed.error?.includes("Godot executable not found")) {
      return t("mcp.godotPathRequired");
    }
    if (parsed.error) return parsed.error;
  } catch {
    /* use raw message */
  }
  return message;
}

export function McpTab({
  projectId,
  projectPath,
  initialStatus = null,
  pluginInstalled = true,
  refreshNonce = 0,
}: {
  projectId: string;
  projectPath: string;
  initialStatus?: McpStatus | null;
  pluginInstalled?: boolean;
  refreshNonce?: number;
}) {
  const { t } = useTranslation();
  const [tools, setTools] = useState<McpToolDefinition[]>([]);
  const [toolsLoaded, setToolsLoaded] = useState(false);
  const [status, setStatus] = useState<McpStatus | null>(initialStatus);
  const [logs, setLogs] = useState<string[]>([]);
  const [selectedTool, setSelectedTool] = useState("");
  const [args, setArgs] = useState("{}");
  const [result, setResult] = useState("");
  const [query, setQuery] = useState("");
  const [loadingCall, setLoadingCall] = useState(false);
  const [busyAction, setBusyAction] = useState<"start" | "stop" | "openGodot" | null>(null);

  const load = async () => {
    const [loadedTools, loadedLogs, loadedStatus] = await Promise.all([
      api.getMcpTools(projectId),
      api.getMcpLogs(projectId),
      api.getStatus(projectId),
    ]);
    setTools(loadedTools);
    setToolsLoaded(true);
    setLogs(loadedLogs.logs);
    setStatus(loadedStatus);
  };

  useEffect(() => {
    load().catch(console.error);

    return subscribeEvents((event) => {
      if (event.type === "mcp:log") {
        const payload = event.payload as { line?: string; projectId?: string };
        if (payload.projectId === projectId || payload.projectId === "*") {
          setLogs((current) => [...current, payload.line ?? ""].slice(-100));
        }
      }
      if (event.type === "mcp:connect" || event.type === "mcp:disconnect") {
        const payload = event.payload as { projectId?: string };
        if (payload.projectId === projectId) {
          api.getStatus(projectId).then(setStatus).catch(() => {});
        }
      }
    });
  }, [projectId]);

  useEffect(() => {
    if (refreshNonce === 0) return;
    load().catch(console.error);
  }, [projectId, refreshNonce]);

  const selectedToolDef = tools.find((tool) => tool.name === selectedTool) ?? null;

  useEffect(() => {
    if (!selectedToolDef) return;
    const schema = selectedToolDef.inputSchema;
    const properties =
      typeof schema === "object" && schema !== null && "properties" in schema
        ? (schema.properties as Record<string, unknown>)
        : {};
    const defaults = Object.keys(properties).reduce<Record<string, unknown>>((acc, key) => {
      acc[key] = key === "projectPath" ? projectPath : "";
      return acc;
    }, {});
    setArgs(JSON.stringify(defaults, null, 2));
  }, [selectedToolDef?.name, projectPath]);

  const filteredTools = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return tools;
    return tools.filter((tool) =>
      tool.name.toLowerCase().includes(normalized) ||
      tool.description.toLowerCase().includes(normalized) ||
      tool.source.toLowerCase().includes(normalized)
    );
  }, [tools, query]);

  const handleCall = async () => {
    try {
      setLoadingCall(true);
      const parsed = JSON.parse(args);
      const res = await api.callMcpTool(projectId, selectedTool, parsed);
      setResult(JSON.stringify(res, null, 2));
    } catch (e) {
      setResult(formatMcpError(String(e), t));
    } finally {
      setLoadingCall(false);
    }
  };

  const handleStart = async () => {
    try {
      setBusyAction("start");
      const nextStatus = await api.startMcp(projectId);
      setStatus(nextStatus);
    } finally {
      setBusyAction(null);
    }
  };

  const handleOpenInGodot = async () => {
    try {
      setBusyAction("openGodot");
      await api.callMcpTool(projectId, "launch_editor", { projectPath });
      setResult(t("mcp.openInGodotSuccess"));
    } catch (e) {
      setResult(formatMcpError(String(e), t));
    } finally {
      setBusyAction(null);
    }
  };

  const handleStop = async () => {
    try {
      setBusyAction("stop");
      await api.stopMcp();
      const nextStatus = await api.getStatus(projectId);
      setStatus(nextStatus);
    } finally {
      setBusyAction(null);
    }
  };

  const schemaPreview = selectedToolDef?.inputSchema
    ? JSON.stringify(selectedToolDef.inputSchema, null, 2)
    : "";

  return (
    <div className="grid w-full min-w-0 gap-6 lg:grid-cols-[minmax(0,26.25rem)_minmax(0,1fr)]">
      <Card className="min-w-0 px-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="font-semibold">{t("mcp.tools")} ({tools.length})</h3>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Badge variant={status?.connected ? "default" : "cli"}>
                {status?.connected ? t("project.pluginConnected") : t("project.pluginDisconnected")}
              </Badge>
              <Badge variant={pluginInstalled ? "default" : "cli"}>
                {pluginInstalled ? t("project.pluginInstalled") : t("project.pluginNotInstalled")}
              </Badge>
              <span>{status?.toolCount ?? tools.length} tools</span>
              {status?.pluginVersion && <span>v{status.pluginVersion}</span>}
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleStart} disabled={busyAction !== null}>
              {busyAction === "start" ? "..." : t("mcp.start")}
            </Button>
            <Button variant="outline" onClick={handleStop} disabled={busyAction !== null}>
              {busyAction === "stop" ? "..." : t("mcp.stop")}
            </Button>
          </div>
        </div>
        {!status?.connected && (
          <div className="mb-4 rounded-lg border border-border bg-muted/40 p-3 text-sm">
            <p className="mb-2 font-medium">{t("mcp.setupTitle")}</p>
            <ul className="space-y-1 text-muted-foreground">
              <li>1. {t("mcp.setupStepServer")}</li>
              <li>2. {pluginInstalled ? t("mcp.setupStepPlugin") : t("project.pluginNotInstalled")}</li>
              <li>3. {t("mcp.setupStepGodot")}</li>
            </ul>
            {!pluginInstalled && (
              <p className="mt-2 text-xs text-muted-foreground">{t("project.pluginConnectHint")}</p>
            )}
            <p className="mt-2 text-xs text-muted-foreground">{t("mcp.setupReloadGodot")}</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={handleOpenInGodot}
              disabled={busyAction !== null}
            >
              {busyAction === "openGodot" ? "..." : t("mcp.openInGodot")}
            </Button>
          </div>
        )}
        {toolsLoaded && tools.length < 50 && (
          <div className="mb-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-600 dark:text-amber-400">
            {t("mcp.toolsManifestWarning", { count: tools.length })}
          </div>
        )}
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("mcp.search")}
          className="mb-3"
        />
        <div className="mb-3 break-all text-xs text-muted-foreground">
          {status?.relayUrl ?? `ws://127.0.0.1:6505/ws/${projectId}`}
        </div>
        <div className="max-h-128 space-y-1 overflow-auto">
          {filteredTools.map((tool) => (
            <button
              key={tool.name}
              onClick={() => setSelectedTool(tool.name)}
              className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm hover:bg-muted ${
                selectedTool === tool.name ? "bg-muted" : ""
              }`}
            >
              <div className="min-w-0">
                <div className="truncate font-mono">{tool.name}</div>
                <div className="truncate text-xs text-muted-foreground">{tool.description}</div>
              </div>
              <Badge
                variant={
                  tool.source === "cli"
                    ? "cli"
                    : tool.source === "builtin"
                      ? "secondary"
                      : "default"
                }
              >
                {tool.source}
              </Badge>
            </button>
          ))}
        </div>
      </Card>

      <div className="min-w-0 space-y-4">
        <Card className="min-w-0 px-4">
          <h3 className="mb-2 font-semibold">{t("mcp.testCall")}: {selectedTool || "—"}</h3>
          {selectedToolDef && (
            <p className="mb-3 text-sm text-muted-foreground">{selectedToolDef.description}</p>
          )}
          {selectedToolDef?.source === "plugin" && !status?.connected && (
            <p className="mb-3 text-sm text-muted-foreground">{t("mcp.pluginToolRequiresEditor")}</p>
          )}
          {schemaPreview && (
            <>
              <p className="mb-2 text-xs font-medium text-muted-foreground">{t("mcp.schema")}</p>
              <pre className="mb-3 max-h-40 max-w-full overflow-x-auto rounded-lg bg-muted p-3 text-xs">{schemaPreview}</pre>
            </>
          )}
          <p className="mb-2 text-xs font-medium text-muted-foreground">{t("mcp.arguments")}</p>
          <Textarea
            value={args}
            onChange={(e) => setArgs(e.target.value)}
            className="mb-3 w-full min-w-0 font-mono text-xs"
            rows={10}
          />
          <Button onClick={handleCall} disabled={!selectedTool || loadingCall}>
            {loadingCall ? "..." : t("mcp.testCall")}
          </Button>
          {result && (
            <pre className="mt-3 max-h-64 max-w-full overflow-x-auto rounded-lg bg-muted p-3 text-xs">{result}</pre>
          )}
        </Card>

        <Card className="min-w-0 px-4">
          <h3 className="mb-2 font-semibold">{t("mcp.logs")}</h3>
          <pre className="max-h-72 max-w-full overflow-x-auto rounded-lg bg-muted p-3 text-xs text-muted-foreground">
            {logs.join("\n") || "No logs"}
          </pre>
        </Card>
      </div>
    </div>
  );
}
