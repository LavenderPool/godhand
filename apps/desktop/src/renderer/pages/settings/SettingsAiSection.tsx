import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api, type ProviderSetting } from "@/lib/api";

export function SettingsAiSection() {
  const { t } = useTranslation();
  const [providers, setProviders] = useState<ProviderSetting[]>([]);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [keys, setKeys] = useState<Record<string, string>>({});
  const [testResults, setTestResults] = useState<Record<string, boolean | null>>({});
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = async () => {
    try {
      setLoadError(null);
      const [p, s] = await Promise.all([api.getProviders(), api.getSettings()]);
      setProviders(p);
      setSettings(s);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : String(error));
    }
  };

  useEffect(() => { load(); }, []);

  const saveProvider = async (id: string, enabled: boolean) => {
    await api.patchProvider(id, {
      apiKey: keys[id] || undefined,
      enabled,
    });
    load();
  };

  const testProvider = async (id: string) => {
    if (keys[id]) {
      await api.patchProvider(id, { apiKey: keys[id], enabled: true });
    }
    const res = await api.testProvider(id);
    setTestResults((r) => ({ ...r, [id]: res.ok }));
  };

  const [detectingGodot, setDetectingGodot] = useState(false);

  const detectGodotPath = async () => {
    setDetectingGodot(true);
    try {
      const res = await api.detectGodot();
      if (res.path) {
        setSettings((s) => ({ ...s, godotPath: res.path! }));
        alert(t("settings.godotPathDetected", { path: res.path }));
      } else {
        alert(t("settings.godotPathNotFound"));
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : String(error));
    } finally {
      setDetectingGodot(false);
    }
  };

  const saveSettings = async () => {
    await api.patchSettings(settings);
    alert(t("settings.settingsSaved"));
  };

  return (
    <>
      <section className="mb-10">
        <h2 className="mb-4 text-lg font-medium">{t("settings.providers")}</h2>
        {loadError && (
          <p className="mb-4 text-sm text-red-500">{t("settings.providersLoadError")}</p>
        )}
        <div className="space-y-4">
          {providers.map((p) => (
            <Card key={p.id} className="px-4">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h3 className="font-medium">{p.name}</h3>
                  <p className="text-xs text-muted-foreground">{p.description}</p>
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={p.enabled}
                    onChange={(e) => saveProvider(p.id, e.target.checked)}
                  />
                  ON
                </label>
              </div>
              <div className="mb-2 flex gap-2">
                <Input
                  type="password"
                  placeholder={p.apiKeyMasked || t("settings.apiKey")}
                  value={keys[p.id] ?? ""}
                  onChange={(e) => setKeys((k) => ({ ...k, [p.id]: e.target.value }))}
                />
                <Button variant="outline" onClick={() => testProvider(p.id)}>
                  {t("settings.test")}
                </Button>
              </div>
              {testResults[p.id] !== undefined && testResults[p.id] !== null && (
                <p className={`text-xs ${testResults[p.id] ? "text-green-600" : "text-red-500"}`}>
                  {testResults[p.id] ? "OK" : "Failed"}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Models: {p.models.join(", ")}
              </p>
            </Card>
          ))}
        </div>
      </section>

      <section className="mb-10">
        <h2 className="mb-4 text-lg font-medium">LLM Providers</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Use the same API key fields above for openai / anthropic. Ollama runs locally without a key.
        </p>
      </section>

      <section>
        <h2 className="mb-4 text-lg font-medium">General</h2>
        <Card className="space-y-4 px-4">
          <div>
            <label className="mb-1 block text-sm">{t("settings.defaultProvider")}</label>
            <select
              className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
              value={settings.defaultImageProvider ?? "openai"}
              onChange={(e) => setSettings((s) => ({ ...s, defaultImageProvider: e.target.value }))}
            >
              {providers.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm">{t("settings.godotPath")}</label>
            <div className="flex gap-2">
              <Input
                value={settings.godotPath ?? ""}
                onChange={(e) => setSettings((s) => ({ ...s, godotPath: e.target.value }))}
              />
              <Button variant="outline" onClick={detectGodotPath} disabled={detectingGodot}>
                {detectingGodot ? "..." : t("settings.detectGodot")}
              </Button>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm">{t("settings.memoryUrl")}</label>
            <Input
              value={settings.memoryServiceUrl ?? ""}
              onChange={(e) => setSettings((s) => ({ ...s, memoryServiceUrl: e.target.value }))}
            />
          </div>
          <Button onClick={saveSettings}>{t("settings.save")}</Button>
        </Card>
      </section>
    </>
  );
}
