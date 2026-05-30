import type { SkillPlugin } from "@godhand/shared";

export const godotWorkflowSkill: SkillPlugin = {
  id: "godot-workflow",
  name: "Godot Workflow",
  description: "Essential Godot MCP Pro workflows",
  category: "workflow",
  systemPrompt: `Always start by calling get_project_info and get_filesystem_tree before making changes.
Use save_scene after editing scenes. All changes go through Godot UndoRedo.`,
};

export const skills: SkillPlugin[] = [godotWorkflowSkill];

export function loadSkillPlugins(): SkillPlugin[] {
  return skills;
}
