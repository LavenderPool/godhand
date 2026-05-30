# @godhand/mcp-godot

MCP server + Godot 4 editor plugin that lets an AI build, run, inspect, and ship Godot games. It exposes ~190 tools, plus MCP resources and prompts, optimized for creating great 2D and 3D games from a single prompt - including mobile (Android/iOS).

## Architecture

```
AI / Cursor ──MCP stdio──> mcp-server.ts ──┬── builtin tools (get_godot_guide)
                                            ├── CLI tools (godot-cli.ts, headless Godot)
                                            └── plugin tools ──ws relay──> Godot editor plugin
                                                                            (command_router.gd -> commands/*.gd)
```

- `src/mcp-server.ts` - MCP server. Exposes `tools`, `resources` (`godot-guide://`, `godot-skills://`) and `prompts`.
- `src/guides.ts` - in-process workflow guidance behind the `get_godot_guide` builtin tool and the guide resources.
- `src/cli-tools/godot-cli.ts` - tools that run a headless Godot process (export, run, project ops).
- `plugin/` - the Godot editor plugin. `command_router.gd` registers all `commands/*_commands.gd` classes; each exposes handlers via `get_commands()` built on `base_command.gd` (UndoRedo + error helpers).
- `plugin/commands/_tool_meta.json` - rich metadata sidecar (descriptions, enums, defaults, examples) merged into the generated manifest.
- `scripts/generate-tool-manifest.ts` - statically parses `commands/*.gd` (params + `##` docstrings), merges `_tool_meta.json`, and writes `src/generated/godot-pro-tools.json`.

## How the AI gets context

1. `get_godot_guide` builtin tool (call first; topics: overview, quickstart-2d, quickstart-3d, mobile, optimization, animation, shaders, testing, export).
2. MCP resources: `godot-guide://<topic>` and `godot-skills://skills.md`.
3. MCP prompts: `build-2d-mobile-game`, `build-3d-mobile-game`.
4. Tool descriptions carry `[SOURCE/category]` tags, enum/default schemas, and an inline example.
5. `plugin/skills.md` / `skills.ru.md` - full human-readable reference (also copy to `.claude/skills.md`).

## Tool categories

| Area | Examples |
|------|----------|
| Project / FS | get_project_info, get_filesystem_tree, set_project_setting |
| Scenes / Nodes | create_scene, add_node, add_scene_instance, save_scene |
| Scripts | create_script, edit_script, validate_script |
| 2D | setup_camera_2d, setup_parallax, add_animated_sprite, setup_light_2d, create_tileset, setup_2d_platformer_player, tilemap_* |
| 3D | add_mesh_instance, setup_lighting, setup_environment, setup_csg, add_multimesh, add_reflection_probe, add_decal, setup_3d_character |
| Physics / Nav / FX | setup_collision, setup_navigation_region, create_particles, create_shader, animation* |
| Runtime / QA | play_scene, get_game_screenshot, simulate_action, run_test_scenario |
| Mobile | apply_mobile_preset, setup_touch_controls, apply_safe_area, optimize_for_mobile |
| Export | export_project, deploy_to_android, export_ios |

## Build

```
pnpm generate:tools   # regenerate src/generated/godot-pro-tools.json from plugin/commands
pnpm build            # generate:tools + tsc + copy plugin/CLI assets into dist
```

When adding a Godot command file, register it in `plugin/command_router.gd`, add rich metadata to `plugin/commands/_tool_meta.json`, then run `pnpm generate:tools`.
