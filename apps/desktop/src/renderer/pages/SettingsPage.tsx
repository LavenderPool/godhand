import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Sparkles, FolderOpen } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { SettingsAiSection } from "@/pages/settings/SettingsAiSection";
import { SettingsProjectsSection } from "@/pages/settings/SettingsProjectsSection";
import { cn } from "@/lib/utils";

type Section = "ai" | "projects";

const sections: { id: Section; icon: typeof Sparkles; labelKey: string }[] = [
  { id: "ai", icon: Sparkles, labelKey: "settings.navAi" },
  { id: "projects", icon: FolderOpen, labelKey: "settings.navProjects" },
];

export function SettingsPage() {
  const { t } = useTranslation();
  const [section, setSection] = useState<Section>("ai");

  return (
    <AppShell>
      <div className="flex flex-1 overflow-hidden">
        <aside className="w-52 shrink-0 border-r border-border bg-card p-4">
          <h1 className="mb-4 text-lg font-semibold">{t("settings.title")}</h1>
          <nav className="space-y-1">
            {sections.map(({ id, icon: Icon, labelKey }) => (
              <button
                key={id}
                onClick={() => setSection(id)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition",
                  section === id ? "bg-primary text-primary-fg" : "hover:bg-muted"
                )}
              >
                <Icon className="h-4 w-4" />
                {t(labelKey)}
              </button>
            ))}
          </nav>
        </aside>

        <main className="mx-auto max-w-3xl flex-1 overflow-auto p-6">
          {section === "ai" && <SettingsAiSection />}
          {section === "projects" && <SettingsProjectsSection />}
        </main>
      </div>
    </AppShell>
  );
}
