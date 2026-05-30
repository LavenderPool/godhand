import type { McpToolDefinition } from "@godhand/shared";

/**
 * Curated, in-process workflow guidance surfaced to the AI via the
 * `get_godot_guide` builtin tool and as MCP resources. Keeping this content in
 * code (rather than parsing markdown at runtime) makes delivery reliable across
 * MCP clients.
 */

export const GUIDE_TOPICS = [
  "overview",
  "quickstart-2d",
  "quickstart-3d",
  "mobile",
  "optimization",
  "animation",
  "shaders",
  "testing",
  "export",
] as const;

export type GuideTopic = (typeof GUIDE_TOPICS)[number];

const GUIDES: Record<GuideTopic, string> = {
  overview: `# Godot MCP - Overview

You drive a live Godot 4 editor through MCP tools. All edits go through Godot's UndoRedo, so they are reversible and reflected in the editor immediately.

## Golden rules
1. Start every session with \`get_project_info\` and \`get_filesystem_tree\` to understand the project.
2. Open or create a scene before editing nodes (\`open_scene\` / \`create_scene\`). Most node tools fail with "No scene is currently open" otherwise.
3. After editing a scene, call \`save_scene\`.
4. Property values use Godot literal strings: \`Vector2(10, 20)\`, \`Color(1, 0, 0, 1)\`, \`true\`, \`3.14\`, or a \`res://\` path for resources.
5. Prefer high-level builders (\`setup_2d_platformer_player\`, \`setup_3d_character\`, \`apply_mobile_preset\`, \`setup_touch_controls\`) to assemble a playable game fast, then refine with granular tools.
6. Playtest with \`play_scene\`, then inspect with \`get_game_scene_tree\`, \`get_game_screenshot\`, \`simulate_action\`; \`stop_scene\` when done.

## Recommended order for a new game
1. Project setup: \`set_project_setting\`, input map via \`set_input_action\`.
2. For phones: \`apply_mobile_preset\` early.
3. Build the player: \`setup_2d_platformer_player\` or \`setup_3d_character\`.
4. World: tilemaps/parallax/lights (2D) or meshes/lighting/environment (3D).
5. Gameplay scripts, UI/HUD, audio.
6. Polish: animations, particles, shaders.
7. Playtest loop and \`optimize_for_mobile\`.
8. Export: \`deploy_to_android\` / \`export_ios\` / \`export_project\`.

Call \`get_godot_guide\` with topic \`quickstart-2d\`, \`quickstart-3d\` or \`mobile\` for step-by-step recipes.`,

  "quickstart-2d": `# Quickstart - 2D game from one prompt

A complete, satisfying 2D platformer skeleton:

1. \`set_input_action\` for move_left, move_right, jump (map keys + later touch).
2. \`setup_2d_platformer_player\` { scene_path: "res://scenes/player.tscn", add_camera: true } - builds CharacterBody2D + Sprite2D + CollisionShape2D + movement script + follow Camera2D.
3. World scene: \`create_scene\` { root_type: "Node2D", path: "res://scenes/world.tscn" }, then \`add_scene_instance\` to place the player.
4. Ground/level: \`create_tileset\` from a texture, then \`tilemap_fill_rect\` / \`tilemap_set_cell\` on a TileMapLayer. Add \`setup_collision\` for solid tiles or a StaticBody2D floor.
5. Atmosphere: \`setup_parallax\` for scrolling backgrounds, \`setup_light_2d\` for mood.
6. Feel: \`apply_particle_preset\` (dust on land, sparks on jump), \`create_animation\` for squash/stretch.
7. HUD: \`create_theme\`, add a CanvasLayer with Labels; \`set_anchor_preset\`.
8. Audio: \`add_audio_player\` for music/SFX.
9. Playtest: \`play_scene\`, \`simulate_action\`, \`get_game_screenshot\`, iterate.
10. Save everything with \`save_scene\`.

For phones, run the \`mobile\` guide too (touch controls + mobile preset).`,

  "quickstart-3d": `# Quickstart - 3D game from one prompt

A complete 3D third-person skeleton:

1. \`set_input_action\` for movement + jump.
2. \`setup_3d_character\` { scene_path: "res://scenes/player.tscn", mesh_type: "CapsuleMesh", add_camera: true } - CharacterBody3D + mesh + CollisionShape3D + SpringArm3D camera + movement script.
3. World scene: \`create_scene\` { root_type: "Node3D" }; place the player via \`add_scene_instance\`.
4. Ground/level: \`setup_csg\` (CSGBox3D) for a fast blockout, or \`add_mesh_instance\` + \`setup_collision\` (dimension 3d). Use \`add_multimesh\` for repeated props (mobile-friendly).
5. Lighting: \`setup_lighting\` { preset: "sun", shadows: true } + \`setup_environment\` { background_mode: "sky", tonemap_mode: "ACES" }.
6. Materials: \`set_material_3d\` (PBR) on meshes.
7. Polish: \`create_particles\` { is_3d: true } + \`apply_particle_preset\`, \`setup_navigation_region\` { dimension: "3d" } for AI.
8. HUD + audio as in 2D.
9. Playtest with \`play_scene\` + \`get_game_screenshot\`; iterate.
10. \`save_scene\`.

Keep it mobile-friendly: prefer the Mobile renderer (\`apply_mobile_preset\`), few real-time shadows, MultiMesh for crowds.`,

  mobile: `# Mobile - iOS & Android, optimized for phones

## Make it mobile-ready
1. \`apply_mobile_preset\` { renderer: "mobile", stretch_mode: "canvas_items", stretch_aspect: "expand", vram_compression: true, fps_cap: 60 } - sets renderer, stretch, texture compression, AA and FPS cap in one call. Run this early.
2. \`setup_touch_controls\` { joystick: true, buttons: [{ action: "jump", text: "A" }] } - adds an on-screen virtual joystick + buttons on a CanvasLayer wired to your input actions, so a keyboard game becomes playable by touch.
3. \`apply_safe_area\` { node_path: "HUD" } - keeps UI clear of notches/rounded corners using DisplayServer.get_display_safe_area at runtime.

## Android deploy
1. Configure an Android export preset in Godot (Project > Export) once.
2. \`list_android_devices\` to confirm a device is connected (adb).
3. \`deploy_to_android\` { launch: true } - exports the APK, installs with adb, and launches it.

## iOS deploy (macOS + Xcode required)
1. Configure an iOS export preset.
2. \`get_ios_preset_info\` to verify bundle id / export path.
3. \`export_ios\` - generates the Xcode project / IPA. On non-macOS hosts the tool returns a clear suggestion instead of failing silently.

## Performance
Run \`optimize_for_mobile\` to get prioritized recommendations (draw calls, node count, uncompressed textures, heavy post-effects). See the \`optimization\` guide.`,

  optimization: `# Optimization - keep it smooth on phones

Measure first:
- \`get_performance_monitors\` (FPS, draw calls, video memory, object/orphan counts) while the game runs.
- \`analyze_scene_complexity\` and \`get_project_statistics\` for static analysis.
- \`run_stress_test\` to push the scene.

Then act:
- \`optimize_for_mobile\` { auto_apply: false } to get recommendations; set auto_apply: true for safe automatic fixes.
- Use the Mobile renderer and ETC2/ASTC texture compression (\`apply_mobile_preset\`).
- Replace many duplicated meshes with \`add_multimesh\`.
- Limit real-time shadows and post-processing (glow/SSAO/SSR off on mobile).
- Cap FPS to 60 to save battery.
- \`find_unused_resources\` to trim the export size.`,

  animation: `# Animation

- AnimationPlayer: \`create_animation\`, \`add_animation_track\` (value/method/bezier), \`set_keyframe\`, \`get_animation_info\`.
- AnimatedSprite2D: \`add_animated_sprite\` builds SpriteFrames from a sprite sheet (hframes x vframes) with fps/loop/autoplay.
- AnimationTree: \`create_animation_tree\`, state machine add/remove state + transition, \`set_blend_tree_node\`, \`set_tree_parameter\` for blended character motion.
- Example squash/stretch: create_animation "bounce" -> add value track on scale -> set_keyframe at 0/0.5/1 -> loop.`,

  shaders: `# Shaders

- \`create_shader\` { shader_type: "canvas_item" | "spatial" | "particles" | "sky" } writes a .gdshader file.
- \`assign_shader_material\` attaches it to a CanvasItem (2D) or MeshInstance3D (3D).
- \`set_shader_param\` / \`get_shader_param\` drive uniforms.
- On mobile keep shaders cheap: avoid heavy loops, prefer precomputed textures, mind overdraw with transparent canvas_item shaders.`,

  testing: `# Testing & QA

- \`run_test_scenario\` to script a playthrough; \`assert_node_state\` / \`assert_screen_text\` to verify.
- \`run_stress_test\` for load; \`get_test_report\` to collect results.
- Manual loop: \`play_scene\` -> \`get_game_scene_tree\` / \`get_game_node_properties\` -> \`simulate_action\` / \`click_button_by_text\` -> \`get_game_screenshot\` -> \`stop_scene\`.
- \`get_editor_errors\` and \`get_output_log\` surface script/runtime errors.`,

  export: `# Export

- \`list_export_presets\` and \`get_export_info\` inspect configured presets (export_presets.cfg).
- \`export_project\` { preset_name, debug } actually runs a headless export and produces the binary.
- Android: prefer \`deploy_to_android\` (export + install + launch).
- iOS: \`export_ios\` (macOS + Xcode). Configure presets in Godot's Project > Export first.`,
};

export function getGuide(topic: string): string {
  const key = (GUIDE_TOPICS as readonly string[]).includes(topic) ? (topic as GuideTopic) : "overview";
  return GUIDES[key];
}

export function getAllGuides(): Record<GuideTopic, string> {
  return GUIDES;
}

export const GUIDE_TOOL: McpToolDefinition = {
  name: "get_godot_guide",
  source: "builtin",
  category: "guide",
  description:
    "Return curated Godot MCP workflow guidance for a topic. Call this FIRST with topic 'overview', then 'quickstart-2d'/'quickstart-3d'/'mobile' before building a game.",
  inputSchema: {
    type: "object",
    additionalProperties: false,
    properties: {
      topic: {
        type: "string",
        description: "Guide topic to retrieve",
        enum: [...GUIDE_TOPICS],
        default: "overview",
      },
    },
  },
  examples: [
    { description: "Start here", arguments: { topic: "overview" } },
    { description: "2D recipe", arguments: { topic: "quickstart-2d" } },
  ],
};

export function getBuiltinTools(): McpToolDefinition[] {
  return [GUIDE_TOOL];
}

export function callBuiltinTool(name: string, args: Record<string, unknown>): { result: unknown } {
  if (name === "get_godot_guide") {
    const topic = typeof args.topic === "string" ? args.topic : "overview";
    return { result: { topic, guide: getGuide(topic) } };
  }
  throw new Error(`Unknown builtin tool: ${name}`);
}
