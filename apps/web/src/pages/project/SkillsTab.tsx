import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api, type SkillCard } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export function SkillsTab() {
  const { t } = useTranslation();
  const [skills, setSkills] = useState<SkillCard[]>([]);
  const [filter, setFilter] = useState("");

  const load = () => api.getSkills().then(setSkills).catch(console.error);
  useEffect(() => { load(); }, []);

  const categories = [...new Set(skills.map((s) => s.category))];
  const filtered = skills.filter(
    (s) => !filter || s.category === filter
  );

  const toggle = async (skill: SkillCard) => {
    await api.patchSkill(skill.id, !skill.enabled, skill);
    load();
  };

  return (
    <div>
      <div className="mb-6 flex gap-4">
        <Input
          placeholder={t("skills.filter")}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          list="categories"
          className="max-w-xs"
        />
        <datalist id="categories">
          {categories.map((c) => <option key={c} value={c} />)}
        </datalist>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((skill) => (
          <Card key={skill.id} className="px-4">
            <div className="mb-2 flex items-start justify-between">
              <h3 className="font-medium">{skill.name}</h3>
              <button
                onClick={() => toggle(skill)}
                className={`rounded-full px-2 py-0.5 text-xs ${
                  skill.enabled ? "bg-green-500/20 text-green-600" : "bg-muted text-muted-foreground"
                }`}
              >
                {skill.enabled ? t("skills.enabled") : t("skills.disabled")}
              </button>
            </div>
            <p className="mb-2 text-xs text-muted-foreground">{skill.category}</p>
            <p className="text-sm text-muted-foreground line-clamp-3">{skill.description}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
