import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Gamepad2 } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { api, type Project } from "@/lib/api";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

function folderNameFromPath(filePath: string): string {
  const normalized = filePath.trim().replace(/[\\/]+$/, "");
  if (!normalized) return "";
  const i = Math.max(normalized.lastIndexOf("/"), normalized.lastIndexOf("\\"));
  return i === -1 ? normalized : normalized.slice(i + 1);
}

export function HomePage() {
  const { t } = useTranslation();
  const [projects, setProjects] = useState<Project[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState("");
  const [path, setPath] = useState("");

  const load = () => api.getProjects().then(setProjects).catch(console.error);
  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!name || !path) return;
    await api.createProject(name, path);
    setDialogOpen(false);
    setName("");
    setPath("");
    load();
  };

  const setPathWithAutoName = (nextPath: string) => {
    setPath(nextPath);
    setName((current) => {
      if (current.trim()) return current;
      const derived = folderNameFromPath(nextPath);
      return derived || current;
    });
  };

  const handleBrowse = async () => {
    const res = await api.browseFolder();
    if (res.path) setPathWithAutoName(res.path);
  };

  return (
    <AppShell>
      <main className="mx-auto w-full max-w-6xl flex-1 overflow-auto px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold">{t("app.projects")}</h1>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            {t("app.newProject")}
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
            <Link key={p.id} to="/project/$id" params={{ id: p.id }}>
              <Card className="cursor-pointer px-4 transition hover:ring-primary/50 hover:shadow-md">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-muted">
                  <Gamepad2 className="h-6 w-6" />
                </div>
                <h3 className="font-semibold">{p.name}</h3>
                <p className="mt-1 truncate text-xs text-muted-foreground">{p.path}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {p.godotVersion ? `v${p.godotVersion}` : "Godot"}
                </p>
              </Card>
            </Link>
          ))}

          <button
            onClick={() => setDialogOpen(true)}
            className="flex min-h-[140px] flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card text-muted-foreground transition hover:border-primary hover:text-primary"
          >
            <Plus className="mb-2 h-8 w-8" />
            {t("app.addProject")}
          </button>
        </div>
      </main>

      {dialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-md px-4">
            <h2 className="mb-4 text-lg font-semibold">{t("app.newProject")}</h2>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-sm">{t("dialog.projectName")}</label>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div>
                <label className="mb-1 block text-sm">{t("dialog.projectPath")}</label>
                <div className="flex gap-2">
                  <Input value={path} onChange={(e) => setPathWithAutoName(e.target.value)} />
                  <Button variant="outline" onClick={handleBrowse}>{t("dialog.browse")}</Button>
                </div>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>{t("dialog.cancel")}</Button>
              <Button onClick={handleCreate}>{t("dialog.create")}</Button>
            </div>
          </Card>
        </div>
      )}
    </AppShell>
  );
}
