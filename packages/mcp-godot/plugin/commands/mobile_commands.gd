@tool
extends "res://addons/godot_mcp/commands/base_command.gd"

const PropertyParser := preload("res://addons/godot_mcp/utils/property_parser.gd")


func get_commands() -> Dictionary:
	return {
		"apply_mobile_preset": _apply_mobile_preset,
		"setup_touch_controls": _setup_touch_controls,
		"apply_safe_area": _apply_safe_area,
		"optimize_for_mobile": _optimize_for_mobile,
	}


func _add_child_with_undo(node: Node, parent: Node, root: Node, action_name: String) -> void:
	var undo_redo := get_undo_redo()
	undo_redo.create_action(action_name)
	undo_redo.add_do_method(parent, "add_child", node)
	undo_redo.add_do_method(node, "set_owner", root)
	undo_redo.add_do_reference(node)
	undo_redo.add_undo_method(parent, "remove_child", node)
	undo_redo.commit_action()


## ─── 1. apply_mobile_preset ────────────────────────────────────────────────

func _apply_mobile_preset(params: Dictionary) -> Dictionary:
	var applied: Dictionary = {}

	var renderer: String = optional_string(params, "renderer", "mobile")
	match renderer:
		"mobile":
			ProjectSettings.set_setting("rendering/renderer/rendering_method", "mobile")
			ProjectSettings.set_setting("rendering/renderer/rendering_method.mobile", "mobile")
		"gl_compatibility":
			ProjectSettings.set_setting("rendering/renderer/rendering_method", "gl_compatibility")
			ProjectSettings.set_setting("rendering/renderer/rendering_method.mobile", "gl_compatibility")
		_:
			return error_invalid_params("Unknown renderer '%s'. Available: mobile, gl_compatibility" % renderer)
	applied["renderer"] = renderer

	var stretch_mode: String = optional_string(params, "stretch_mode", "canvas_items")
	ProjectSettings.set_setting("display/window/stretch/mode", stretch_mode)
	applied["stretch_mode"] = stretch_mode

	var stretch_aspect: String = optional_string(params, "stretch_aspect", "expand")
	ProjectSettings.set_setting("display/window/stretch/aspect", stretch_aspect)
	applied["stretch_aspect"] = stretch_aspect

	var base_width: int = optional_int(params, "base_width", 1080)
	var base_height: int = optional_int(params, "base_height", 1920)
	ProjectSettings.set_setting("display/window/size/viewport_width", base_width)
	ProjectSettings.set_setting("display/window/size/viewport_height", base_height)
	applied["viewport"] = {"width": base_width, "height": base_height}

	# Mobile orientation default: portrait unless overridden.
	if params.has("orientation"):
		ProjectSettings.set_setting("display/window/handheld/orientation", str(params["orientation"]))
		applied["orientation"] = str(params["orientation"])

	var vram: bool = optional_bool(params, "vram_compression", true)
	ProjectSettings.set_setting("rendering/textures/vram_compression/import_etc2_astc", vram)
	applied["vram_compression_etc2_astc"] = vram

	var msaa: String = optional_string(params, "msaa", "disabled")
	var msaa_val := 0
	match msaa:
		"disabled":
			msaa_val = 0
		"2x":
			msaa_val = 1
		"4x":
			msaa_val = 2
	ProjectSettings.set_setting("rendering/anti_aliasing/quality/msaa_2d", msaa_val)
	ProjectSettings.set_setting("rendering/anti_aliasing/quality/msaa_3d", msaa_val)
	applied["msaa"] = msaa

	var fps_cap: int = optional_int(params, "fps_cap", 60)
	ProjectSettings.set_setting("application/run/max_fps", fps_cap)
	applied["fps_cap"] = fps_cap

	var err := ProjectSettings.save()
	if err != OK:
		return error_internal("Failed to save project settings: %s" % error_string(err))

	return success({
		"applied": applied,
		"message": "Mobile-optimized project settings applied. Reload the project for renderer changes to fully take effect.",
	})


## ─── 2. setup_touch_controls ───────────────────────────────────────────────

func _setup_touch_controls(params: Dictionary) -> Dictionary:
	var root := get_edited_root()
	if root == null:
		return error_no_scene()

	var parent_path: String = optional_string(params, "parent_path", ".")
	var parent := find_node_by_path(parent_path)
	if parent == null:
		return error_not_found("Parent node '%s'" % parent_path)

	var layer := CanvasLayer.new()
	layer.name = optional_string(params, "name", "TouchControls")
	_add_child_with_undo(layer, parent, root, "MCP: Add TouchControls")

	var created: Array = []

	# Directional pad (left/right, optionally up/down) as TouchScreenButtons.
	if optional_bool(params, "joystick", true):
		var dpad := {
			"TouchLeft": {"action": optional_string(params, "left_action", "ui_left"), "pos": Vector2(60, 760)},
			"TouchRight": {"action": optional_string(params, "right_action", "ui_right"), "pos": Vector2(220, 760)},
		}
		if optional_bool(params, "vertical", false):
			dpad["TouchUp"] = {"action": optional_string(params, "up_action", "ui_up"), "pos": Vector2(140, 680)}
			dpad["TouchDown"] = {"action": optional_string(params, "down_action", "ui_down"), "pos": Vector2(140, 840)}
		for btn_name in dpad:
			var data: Dictionary = dpad[btn_name]
			var btn := _make_touch_button(btn_name, data["action"], data["pos"], Vector2(120, 120))
			layer.add_child(btn)
			btn.owner = root
			created.append({"name": btn_name, "action": data["action"]})

	# Action buttons (right side of the screen).
	var buttons: Array = params.get("buttons", [])
	var bx := 940
	var by := 760
	for b in buttons:
		if not (b is Dictionary):
			continue
		var action := str(b.get("action", ""))
		if action.is_empty():
			continue
		var label := str(b.get("text", action))
		var btn := _make_touch_button("Touch_" + action, action, Vector2(bx, by), Vector2(140, 140))
		layer.add_child(btn)
		btn.owner = root
		created.append({"name": str(btn.name), "action": action, "text": label})
		bx -= 170

	return success({
		"node_path": str(root.get_path_to(layer)),
		"name": str(layer.name),
		"controls": created,
		"suggestion": "Map these input actions with set_input_action so they also work via keyboard.",
	})


func _make_touch_button(node_name: String, action: String, pos: Vector2, size: Vector2) -> TouchScreenButton:
	var btn := TouchScreenButton.new()
	btn.name = node_name
	btn.action = action
	btn.position = pos
	var shape := RectangleShape2D.new()
	shape.size = size
	btn.shape = shape
	btn.visibility_mode = TouchScreenButton.VISIBILITY_TOUCHSCREEN_ONLY
	return btn


## ─── 3. apply_safe_area ────────────────────────────────────────────────────

const _SAFE_AREA_SCRIPT_PATH := "res://addons/godot_mcp/runtime/mcp_safe_area.gd"

func _apply_safe_area(params: Dictionary) -> Dictionary:
	var result := require_string(params, "node_path")
	if result[1] != null:
		return result[1]
	var node_path: String = result[0]

	var root := get_edited_root()
	if root == null:
		return error_no_scene()

	var node := find_node_by_path(node_path)
	if node == null:
		return error_not_found("Node '%s'" % node_path)
	if not node is Control:
		return error_invalid_params("Node '%s' is not a Control (is %s)" % [node_path, node.get_class()])

	# Write the runtime helper script if missing.
	var script_dir := _SAFE_AREA_SCRIPT_PATH.get_base_dir()
	if not DirAccess.dir_exists_absolute(script_dir):
		DirAccess.make_dir_recursive_absolute(script_dir)
	if not FileAccess.file_exists(_SAFE_AREA_SCRIPT_PATH):
		var f := FileAccess.open(_SAFE_AREA_SCRIPT_PATH, FileAccess.WRITE)
		if f == null:
			return error_internal("Cannot write safe-area helper: %s" % error_string(FileAccess.get_open_error()))
		f.store_string(_safe_area_script_src())
		f.close()
		EditorInterface.get_resource_filesystem().scan()

	var control := node as Control
	control.set_anchors_preset(Control.PRESET_FULL_RECT)
	var script_res: Script = load(_SAFE_AREA_SCRIPT_PATH)
	if script_res != null:
		control.set_script(script_res)
	mark_current_scene_unsaved()

	return success({
		"node_path": node_path,
		"script": _SAFE_AREA_SCRIPT_PATH,
		"message": "Control will respect the device safe area at runtime. Call save_scene to persist.",
	})


func _safe_area_script_src() -> String:
	return "@tool\nextends Control\n\n" + \
		"## Attached by MCP apply_safe_area: keeps this Control inside the device safe area\n" + \
		"## (notch / rounded corners) at runtime.\n\n" + \
		"func _ready() -> void:\n" + \
		"\t_apply()\n" + \
		"\tget_viewport().size_changed.connect(_apply)\n\n" + \
		"func _apply() -> void:\n" + \
		"\tvar safe := DisplayServer.get_display_safe_area()\n" + \
		"\tvar win := DisplayServer.window_get_size()\n" + \
		"\tif win.x <= 0 or win.y <= 0:\n" + \
		"\t\treturn\n" + \
		"\tset_anchors_preset(Control.PRESET_FULL_RECT)\n" + \
		"\toffset_left = safe.position.x\n" + \
		"\toffset_top = safe.position.y\n" + \
		"\toffset_right = -(win.x - (safe.position.x + safe.size.x))\n" + \
		"\toffset_bottom = -(win.y - (safe.position.y + safe.size.y))\n"


## ─── 4. optimize_for_mobile ────────────────────────────────────────────────

func _optimize_for_mobile(params: Dictionary) -> Dictionary:
	var auto_apply: bool = optional_bool(params, "auto_apply", false)
	var recommendations: Array = []
	var stats: Dictionary = {}

	# Renderer
	var method := str(ProjectSettings.get_setting("rendering/renderer/rendering_method", "forward_plus"))
	stats["rendering_method"] = method
	if method == "forward_plus":
		recommendations.append({
			"severity": "high",
			"issue": "Renderer is 'forward_plus' (desktop). Use the Mobile renderer for phones.",
			"fix": "apply_mobile_preset { renderer: 'mobile' }",
		})

	# VRAM compression
	var vram := bool(ProjectSettings.get_setting("rendering/textures/vram_compression/import_etc2_astc", false))
	stats["vram_compression_etc2_astc"] = vram
	if not vram:
		recommendations.append({
			"severity": "high",
			"issue": "ETC2/ASTC texture compression is disabled; textures stay uncompressed in VRAM on mobile.",
			"fix": "Enable rendering/textures/vram_compression/import_etc2_astc and re-import textures.",
		})

	# FPS cap
	var max_fps := int(ProjectSettings.get_setting("application/run/max_fps", 0))
	stats["max_fps"] = max_fps
	if max_fps == 0:
		recommendations.append({
			"severity": "medium",
			"issue": "No FPS cap; uncapped rendering drains battery and heats the device.",
			"fix": "Cap to 60 via application/run/max_fps.",
		})

	# Scene analysis
	var root := get_edited_root()
	if root != null:
		var counts := {"nodes": 0, "lights_with_shadows": 0, "particles": 0, "mesh_instances": 0, "csg": 0}
		_count_recursive(root, counts)
		stats["scene"] = counts
		if counts["lights_with_shadows"] > 4:
			recommendations.append({
				"severity": "high",
				"issue": "%d lights cast real-time shadows. Mobile GPUs handle few shadow casters." % counts["lights_with_shadows"],
				"fix": "Bake lighting or disable shadows on most lights.",
			})
		if counts["csg"] > 0:
			recommendations.append({
				"severity": "medium",
				"issue": "%d CSG nodes in scene. CSG is great for blockouts but heavy at runtime." % counts["csg"],
				"fix": "Convert CSG to baked MeshInstance3D for shipping.",
			})
		if counts["mesh_instances"] > 200:
			recommendations.append({
				"severity": "medium",
				"issue": "%d MeshInstance3D nodes. High draw-call count for mobile." % counts["mesh_instances"],
				"fix": "Use add_multimesh for repeated meshes.",
			})

	var applied: Array = []
	if auto_apply:
		var changed := false
		if method == "forward_plus":
			ProjectSettings.set_setting("rendering/renderer/rendering_method.mobile", "mobile")
			applied.append("rendering_method.mobile=mobile")
			changed = true
		if not vram:
			ProjectSettings.set_setting("rendering/textures/vram_compression/import_etc2_astc", true)
			applied.append("vram_compression_etc2_astc=true")
			changed = true
		if max_fps == 0:
			ProjectSettings.set_setting("application/run/max_fps", 60)
			applied.append("max_fps=60")
			changed = true
		if changed:
			ProjectSettings.save()

	return success({
		"stats": stats,
		"recommendations": recommendations,
		"recommendation_count": recommendations.size(),
		"auto_applied": applied,
	})


func _count_recursive(node: Node, counts: Dictionary) -> void:
	counts["nodes"] += 1
	if node is Light3D and (node as Light3D).shadow_enabled:
		counts["lights_with_shadows"] += 1
	elif node is Light2D and (node as Light2D).shadow_enabled:
		counts["lights_with_shadows"] += 1
	if node is GPUParticles2D or node is GPUParticles3D or node is CPUParticles2D or node is CPUParticles3D:
		counts["particles"] += 1
	if node is MeshInstance3D:
		counts["mesh_instances"] += 1
	if node is CSGShape3D:
		counts["csg"] += 1
	for child in node.get_children():
		_count_recursive(child, counts)
