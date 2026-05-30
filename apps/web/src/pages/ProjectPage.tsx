import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "@tanstack/react-router";
import {
  FolderOpen, Image, BookOpen, Files, Plug, ArrowLeft, Cable,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { api, type ConnectCursorResult, type McpStatus, type Project, subscribeEvents } from "@/lib/api";
import { useAppStore } from "@/store/app";
import { ProjectTab } from "@/pages/project/ProjectTab";
import { McpTab } from "@/pages/project/McpTab";
import { GalleryTab } from "@/pages/project/GalleryTab";
import { SkillsTab } from "@/pages/project/SkillsTab";
import { FilesTab } from "@/pages/project/FilesTab";
import { cn } from "@/lib/utils";

type Tab = "project" | "mcp" | "gallery" | "skills" | "files";

const tabs: { id: Tab; icon: typeof FolderOpen; labelKey: string }[] = [
  { id: "project", icon: FolderOpen, labelKey: "project.tab" },
  { id: "mcp", icon: Plug, labelKey: "project.mcp" },
  { id: "gallery", icon: Image, labelKey: "project.gallery" },
  { id: "skills", icon: BookOpen, labelKey: "project.skills" },
  { id: "files", icon: Files, labelKey: "project.files" },
];

export function ProjectPage() {
  const { t } = useTranslation();
  const { id } = useParams({ from: "/project/$id" });
  const [project, setProject] = useState<(Project & { pluginInstalled?: boolean }) | null>(null);
  const [tab, setTab] = useState<Tab>("project");
  const [status, setStatus] = useState<McpStatus | null>(null);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [refreshingMcp, setRefreshingMcp] = useState(false);
  const setGlobalStatus = useAppStore((s) => s.setStatus);
  const setLastEvent = useAppStore((s) => s.setLastEvent);

  const reloadProject = useCallback(async () => {
    const [loadedProject, loadedStatus] = await Promise.all([
      api.getProject(id),
      api.getStatus(id),
    ]);
    setProject(loadedProject);
    setStatus(loadedStatus);
    setGlobalStatus(loadedStatus);
    setRefreshNonce((current) => current + 1);
  }, [id, setGlobalStatus]);

  useEffect(() => {
    reloadProject().catch(console.error);
    return subscribeEvents((e) => {
      setLastEvent(e);
      if (e.type.startsWith("mcp:")) {
        api.getStatus(id).then((s) => {
          setStatus(s);
          setGlobalStatus(s);
        });
      }
    });
  }, [id, reloadProject, setLastEvent, setGlobalStatus]);

  const handleUpdateCursorConfig = async () => {
    try {
      setRefreshingMcp(true);
      const res: ConnectCursorResult = await api.connectCursor(id);
      const refreshedStatus = await api.getStatus(id);
      const refreshedProject = await api.getProject(id);
      setProject(refreshedProject);
      setStatus(refreshedStatus);
      setGlobalStatus(refreshedStatus);
      setRefreshNonce((current) => current + 1);
      toast.success(
        refreshedStatus.connected
          ? t("project.updateCursorConfigSuccess", {
              configPath: res.configPath ?? "",
              pluginPath: res.pluginPath ?? "",
            })
          : t("project.updateCursorConfigPending", {
              configPath: res.configPath ?? "",
              pluginPath: res.pluginPath ?? "",
            })
      );
      if (res.pluginInstalled !== undefined) {
        setProject((current) => (current ? { ...current, pluginInstalled: res.pluginInstalled } : current));
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    } finally {
      setRefreshingMcp(false);
    }
  };

  if (!project) {
    return (
      <AppShell>
        <div className="flex-1 p-8">Loading...</div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="flex flex-1 overflow-hidden">
        <aside className="w-52 shrink-0 border-r border-border bg-card p-4">
          <Link to="/" className="mb-4 flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
          <nav className="space-y-1">
            {tabs.map(({ id: tabId, icon: Icon, labelKey }) => (
              <button
                key={tabId}
                onClick={() => setTab(tabId)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition",
                  tab === tabId ? "bg-primary text-primary-fg" : "hover:bg-muted"
                )}
              >
                <Icon className="h-4 w-4" />
                {t(labelKey)}
              </button>
            ))}
          </nav>
        </aside>

        <main className="min-w-0 flex-1 overflow-auto p-6">
          <div className="mb-6 flex items-center justify-between">
            <h1 className="text-2xl font-semibold">{project.name}</h1>
            <Button variant="outline" onClick={handleUpdateCursorConfig} disabled={refreshingMcp}>
              <Cable className="mr-2 h-4 w-4" />
              {refreshingMcp ? "..." : t("project.updateCursorConfig")}
            </Button>
          </div>

          {tab === "project" && (
            <ProjectTab
              projectId={id}
              status={status}
              pluginInstalled={project.pluginInstalled ?? true}
            />
          )}
          {tab === "mcp" && (
            <McpTab
              projectId={id}
              projectPath={project.path}
              initialStatus={status}
              pluginInstalled={project.pluginInstalled ?? true}
              refreshNonce={refreshNonce}
            />
          )}
          {tab === "gallery" && <GalleryTab projectId={id} />}
          {tab === "skills" && <SkillsTab />}
          {tab === "files" && <FilesTab projectId={id} projectPath={project.path} />}
        </main>
      </div>
    </AppShell>
  );
}
