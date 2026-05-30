import { useTranslation } from "react-i18next";
import { type McpStatus } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function ProjectTab({
  projectId,
  status,
  pluginInstalled = true,
}: {
  projectId: string;
  status: McpStatus | null;
  pluginInstalled?: boolean;
}) {
  const { t } = useTranslation();

  return (
    <Card className="px-4">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">{t("project.mcpStatus")}:</span>
        <Badge variant={status?.connected ? "default" : "cli"}>
          {status?.connected ? t("project.pluginConnected") : t("project.pluginDisconnected")}
        </Badge>
        <Badge variant={pluginInstalled ? "default" : "cli"}>
          {pluginInstalled ? t("project.pluginInstalled") : t("project.pluginNotInstalled")}
        </Badge>
        {status?.pluginVersion && (
          <span className="text-xs text-muted-foreground">
            Godot MCP Pro v{status.pluginVersion}
          </span>
        )}
      </div>
      <p className="mb-2 text-sm text-muted-foreground">
        WebSocket: {status?.relayUrl ?? `ws://127.0.0.1:6505/ws/${projectId}`}
      </p>
      {!status?.connected && (
        <p className="text-sm text-muted-foreground">{t("project.pluginConnectHint")}</p>
      )}
    </Card>
  );
}
