import { Link } from "@tanstack/react-router";
import { Moon, Sun, Settings, Languages } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/store/app";

export function Header() {
  const { t, i18n } = useTranslation();
  const [dark, setDark] = useState(() => document.documentElement.classList.contains("dark"));
  const status = useAppStore((s) => s.status);
  const toggleSkullOverlay = useAppStore((s) => s.toggleSkullOverlay);

  useEffect(() => {
    const saved = localStorage.getItem("godhand-theme");
    if (saved === "dark" || (!saved && window.matchMedia("(prefers-color-scheme: dark)").matches)) {
      document.documentElement.classList.add("dark");
      setDark(true);
    }
  }, []);

  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("godhand-theme", next ? "dark" : "light");
  };

  const toggleLang = () => {
    const next = i18n.language === "ru" ? "en" : "ru";
    i18n.changeLanguage(next);
    localStorage.setItem("godhand-lang", next);
  };

  return (
    <header className="flex items-center justify-between border-b border-border px-6 py-4">
      <div className="flex items-center gap-1">
        <Link to="/" className="text-xl font-bold tracking-tight">
          {t("app.title")}
        </Link>
        <Button
          variant="ghost"
          size="sm"
          className="text-base leading-none"
          onClick={toggleSkullOverlay}
          title="👋"
        >
          👋
        </Button>
      </div>
      <div className="flex items-center gap-2">
        {status && (
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span>{status.connected ? t("status.mcpOnline") : t("status.mcpOffline")}</span>
            <span>{status.memoryOnline ? t("memory.online") : t("memory.offline")}</span>
          </div>
        )}
        <Button variant="ghost" size="sm" onClick={toggleLang} title={t("app.language")}>
          <Languages className="h-4 w-4" />
          {i18n.language.toUpperCase()}
        </Button>
        <Button variant="ghost" size="sm" onClick={toggleTheme}>
          {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
        <Button asChild variant="ghost" size="sm">
          <Link to="/settings">
            <Settings className="h-4 w-4" />
          </Link>
        </Button>
      </div>
    </header>
  );
}
