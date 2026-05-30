import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowUp } from "lucide-react";
import { IMAGE_SIZES } from "@godhand/shared";
import { api, type Generation, type ProviderSetting } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type ModelOption = {
    id: string;
    providerId: string;
    model: string;
    label: string;
};

function buildModelOptions(providers: ProviderSetting[]): ModelOption[] {
    return providers
        .filter((provider) => provider.enabled)
        .flatMap((provider) =>
            provider.models.map((model) => ({
                id: `${provider.id}::${model}`,
                providerId: provider.id,
                model,
                label: `${provider.name} / ${model}`,
            }))
        );
}

export function GalleryTab({ projectId }: { projectId: string }) {
    const { t } = useTranslation();
    const [generations, setGenerations] = useState<Generation[]>([]);
    const [providers, setProviders] = useState<ProviderSetting[]>([]);
    const [search, setSearch] = useState("");
    const [selected, setSelected] = useState<Generation | null>(null);
    const [prompt, setPrompt] = useState("");
    const [size, setSize] = useState<string>("64x64");
    const [style, setStyle] = useState("pixel-art");
    const [selectedModelId, setSelectedModelId] = useState("");
    const [loading, setLoading] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [bflCredits, setBflCredits] = useState<number | null>(null);
    const [bflCreditsLoading, setBflCreditsLoading] = useState(false);
    const [bflCreditsError, setBflCreditsError] = useState<string | null>(null);

    const bflProvider = providers.find((p) => p.id === "bfl");
    const showBflBalance = Boolean(bflProvider?.enabled && bflProvider.apiKeyMasked);

    const loadBflCredits = useCallback(async () => {
        if (!showBflBalance) {
            setBflCredits(null);
            setBflCreditsError(null);
            return;
        }

        setBflCreditsLoading(true);
        setBflCreditsError(null);
        try {
            const { credits } = await api.getProviderCredits("bfl");
            setBflCredits(credits);
        } catch {
            setBflCredits(null);
            setBflCreditsError(t("gallery.bflBalanceError"));
        } finally {
            setBflCreditsLoading(false);
        }
    }, [showBflBalance, t]);

    useEffect(() => {
        Promise.all([api.getGenerations(projectId), api.getProviders(), api.getSettings()])
            .then(([gens, providerSettings, settings]) => {
                setLoadError(null);
                setGenerations(gens);
                setProviders(providerSettings);

                const modelOptions = buildModelOptions(providerSettings);
                if (!modelOptions.length) return;

                const defaultProviderId = settings.defaultImageProvider ?? "";
                const preferredOption =
                    modelOptions.find((option) => option.providerId === defaultProviderId) ?? modelOptions[0];
                setSelectedModelId(preferredOption.id);
            })
            .catch((error) => {
                setLoadError(error instanceof Error ? error.message : String(error));
            });
    }, [projectId]);

    useEffect(() => {
        void loadBflCredits();
    }, [loadBflCredits]);

    const filtered = generations.filter((g) =>
        !search || g.prompt.toLowerCase().includes(search.toLowerCase())
    );
    const modelOptions = buildModelOptions(providers);

    const handleGenerate = async () => {
        if (!prompt.trim()) return;
        const selectedModel = modelOptions.find((option) => option.id === selectedModelId);
        if (!selectedModel) {
            alert("No model available. Enable at least one provider in settings.");
            return;
        }

        setLoading(true);
        try {
            await api.generate(projectId, {
                prompt: prompt.trim(),
                provider: selectedModel.providerId,
                model: selectedModel.model,
                size,
                style,
            });
            const nextGenerations = await api.getGenerations(projectId);
            setGenerations(nextGenerations);
            setPrompt("");
            if (selectedModel.providerId === "bfl") {
                void loadBflCredits();
            }
        } catch (error) {
            alert(String(error));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div>
            {showBflBalance && (
                <p className="mb-2 text-xs text-muted-foreground">
                    {bflCreditsLoading
                        ? t("gallery.bflBalanceLoading")
                        : bflCreditsError
                            ? bflCreditsError
                            : bflCredits !== null
                                ? t("gallery.bflBalance", { credits: bflCredits })
                                : null}
                </p>
            )}

            <div className="rounded-xl border border-border bg-background p-3">
                <div className="relative w-full flex flex-col gap-2">
                    <Textarea
                        placeholder={t("project.prompt")}
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        className="min-h-[190px] w-full resize-none border-0 bg-transparent p-0 pb-20 p-2 pr-3 outline-none hover:ring-0 focus:ring-0 scrollbar-thin [scrollbar-color:var(--border)_transparent] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border/70 [&::-webkit-scrollbar-thumb:hover]:bg-border"
                    />

                    <div className="pointer-events-none flex justify-between items-end">
                        <div className="pointer-events-auto flex gap-2">
                            <div>
                                <label className="mb-1 block text-xs text-muted-foreground">{t("project.model")}</label>
                                <select
                                    className="h-9 w-56 rounded-lg border border-border bg-background px-3 text-sm"
                                    value={selectedModelId}
                                    onChange={(e) => setSelectedModelId(e.target.value)}
                                >
                                    {modelOptions.length === 0 ? (
                                        <option value="">
                                            {loadError ? t("gallery.providersLoadError") : t("gallery.noModels")}
                                        </option>
                                    ) : (
                                        modelOptions.map((option) => (
                                            <option key={option.id} value={option.id}>
                                                {option.label}
                                            </option>
                                        ))
                                    )}
                                </select>
                            </div>
                            <div>
                                <label className="mb-1 block text-xs text-muted-foreground">{t("project.size")}</label>
                                <select
                                    className="h-9 w-28 rounded-lg border border-border bg-background px-3 text-sm"
                                    value={size}
                                    onChange={(e) => setSize(e.target.value)}
                                >
                                    {IMAGE_SIZES.map((imageSize) => (
                                        <option key={imageSize} value={imageSize}>
                                            {imageSize}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <Button
                            onClick={handleGenerate}
                            disabled={loading || !modelOptions.length}
                            className="pointer-events-auto h-10 w-10 rounded-full p-0"
                            aria-label={t("project.generate")}
                            title={t("project.generate")}
                        >
                            <ArrowUp className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </div>

            <div className="mt-4">
                <label className="mb-2 block text-sm">{t("project.style")}</label>
                <div className="flex flex-wrap gap-2">
                    <button
                        type="button"
                        onClick={() => setStyle("pixel-art")}
                        className={`h-12 min-w-36 rounded-lg border px-4 text-left text-sm transition ${style === "pixel-art"
                                ? "border-primary bg-primary/10 text-primary"
                                : "border-border bg-background hover:border-primary/40"
                            }`}
                    >
                        Pixel Art
                    </button>
                </div>
            </div>

            <Input
                placeholder={t("gallery.search")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="mb-6 max-w-md"
            />

            {filtered.length === 0 ? (
                <p className="text-muted-foreground">{t("gallery.noImages")}</p>
            ) : (
                <div className="columns-2 gap-4 sm:columns-3 lg:columns-4">
                    {filtered.map((g) => (
                        <button
                            key={g.id}
                            onClick={() => setSelected(g)}
                            className="mb-4 block w-full break-inside-avoid overflow-hidden rounded-lg border border-border"
                        >
                            <img
                                src={api.imageUrl(g.imagePath)}
                                alt={g.prompt}
                                className="w-full object-cover"
                            />
                        </button>
                    ))}
                </div>
            )}

            {selected && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
                    onClick={() => setSelected(null)}
                >
                    <div
                        className="max-h-[90vh] max-w-2xl overflow-auto rounded-xl border border-border bg-card p-4 shadow-sm"
                        onClick={(e: React.MouseEvent) => e.stopPropagation()}
                    >
                        <img src={api.imageUrl(selected.imagePath)} alt={selected.prompt} className="mb-4 w-full rounded-lg" />
                        <p className="text-sm"><strong>Prompt:</strong> {selected.prompt}</p>
                        <p className="text-sm text-muted-foreground">Model: {selected.model}</p>
                        <p className="text-xs text-muted-foreground">
                            {new Date(selected.createdAt).toLocaleString()}
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}
