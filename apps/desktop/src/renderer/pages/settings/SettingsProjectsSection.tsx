import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Gamepad2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { api, type Project } from "@/lib/api";

export function SettingsProjectsSection() {
    const { t } = useTranslation();
    const [projects, setProjects] = useState<Project[]>([]);
    const [pendingDelete, setPendingDelete] = useState<Project | null>(null);
    const [deleting, setDeleting] = useState(false);

    const load = () => api.getProjects().then(setProjects).catch(console.error);

    useEffect(() => { load(); }, []);

    const confirmDelete = async () => {
        if (!pendingDelete) return;
        setDeleting(true);
        try {
            await api.deleteProject(pendingDelete.id);
            setProjects((prev) => prev.filter((p) => p.id !== pendingDelete.id));
            setPendingDelete(null);
        } catch (err) {
            console.error(err);
        } finally {
            setDeleting(false);
        }
    };

    return (
        <>
            <section>
                <h2 className="mb-4 text-lg font-medium">{t("settings.projectsTitle")}</h2>
                {projects.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{t("settings.projectsEmpty")}</p>
                ) : (
                    <div className="space-y-1">
                        {projects.map((p) => (
                            <Card key={p.id} className="flex flex-row items-center gap-4 px-4">
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                                    <Gamepad2 className="h-5 w-5" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <h3 className="font-medium">{p.name}</h3>
                                    <p className="truncate text-xs text-muted-foreground">{p.path}</p>
                                    {p.godotVersion && (
                                        <p className="text-xs text-muted-foreground">v{p.godotVersion}</p>
                                    )}
                                </div>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="shrink-0 text-muted-foreground hover:text-destructive"
                                    title={t("settings.removeProject")}
                                    onClick={() => setPendingDelete(p)}
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </Card>
                        ))}
                    </div>
                )}
            </section>

            {pendingDelete && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <Card className="w-full max-w-md px-4">
                        <h2 className="mb-2 text-lg font-semibold">
                            {t("settings.removeProjectConfirm", { name: pendingDelete.name })}
                        </h2>
                        <p className="mb-6 text-sm text-muted-foreground">
                            {t("settings.removeProjectHint")}
                        </p>
                        <div className="flex justify-end gap-2">
                            <Button variant="outline" onClick={() => setPendingDelete(null)} disabled={deleting}>
                                {t("dialog.cancel")}
                            </Button>
                            <Button
                                variant="destructive"
                                onClick={confirmDelete}
                                disabled={deleting}
                            >
                                {t("settings.removeProject")}
                            </Button>
                        </div>
                    </Card>
                </div>
            )}
        </>
    );
}
