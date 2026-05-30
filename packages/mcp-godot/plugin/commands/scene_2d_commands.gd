@tool
extends "res://addons/godot_mcp/commands/base_command.gd"

const PropertyParser := preload("res://addons/godot_mcp/utils/property_parser.gd")
const NodeUtils := preload("res://addons/godot_mcp/utils/node_utils.gd")


func get_commands() -> Dictionary:
	return {
		"setup_camera_2d": _setup_camera_2d,
		"setup_parallax": _setup_parallax,
		"add_animated_sprite": _add_animated_sprite,
		"setup_light_2d": _setup_light_2d,
		"create_tileset": _create_tileset,
		"setup_2d_platformer_player": _setup_2d_platformer_player,
	}


## ─── Helpers ───────────────────────────────────────────────────────────────

func _optional_float(params: Dictionary, key: String, default: float) -> float:
	if params.has(key):
		return float(params[key])
	return default


func _parse_vector2_param(params: Dictionary, key: String, default: Vector2) -> Vector2:
	if not params.has(key):
		return default
	return PropertyParser.parse_value(params[key], TYPE_VECTOR2)


func _parse_color_param(params: Dictionary, key: String, default: Color) -> Color:
	if not params.has(key):
		return default
	return PropertyParser.parse_value(params[key], TYPE_COLOR)


func _add_child_with_undo(node: Node, parent: Node, root: Node, action_name: String) -> void:
	var undo_redo := get_undo_redo()
	undo_redo.create_action(action_name)
	undo_redo.add_do_method(parent, "add_child", node)
	undo_redo.add_do_method(node, "set_owner", root)
	undo_redo.add_do_reference(node)
	undo_redo.add_undo_method(parent, "remove_child", node)
	undo_redo.commit_action()


## ─── 1. setup_camera_2d ────────────────────────────────────────────────────

func _setup_camera_2d(params: Dictionary) -> Dictionary:
	var root := get_edited_root()
	if root == null:
		return error_no_scene()

	var parent_path: String = optional_string(params, "parent_path", ".")
	var parent := find_node_by_path(parent_path)
	if parent == null:
		return error_not_found("Parent node '%s'" % parent_path)

	# Reuse an existing camera if node_path points at one.
	var node_path: String = optional_string(params, "node_path", "")
	var camera: Camera2D = null
	var is_existing := false
	if not node_path.is_empty():
		var existing := find_node_by_path(node_path)
		if existing is Camera2D:
			camera = existing as Camera2D
			is_existing = true
		elif existing != null:
			return error_invalid_params("Node '%s' is not a Camera2D (is %s)" % [node_path, existing.get_class()])

	if camera == null:
		camera = Camera2D.new()
		camera.name = optional_string(params, "name", "Camera2D")

	if params.has("zoom"):
		var z: Variant = params["zoom"]
		if z is float or z is int:
			var f := float(z)
			camera.zoom = Vector2(f, f)
		else:
			camera.zoom = _parse_vector2_param(params, "zoom", Vector2.ONE)
	camera.position_smoothing_enabled = optional_bool(params, "position_smoothing", false)
	if params.has("position_smoothing_speed"):
		camera.position_smoothing_speed = _optional_float(params, "position_smoothing_speed", 5.0)

	for limit_key in ["limit_left", "limit_top", "limit_right", "limit_bottom"]:
		if params.has(limit_key):
			camera.set(limit_key, int(params[limit_key]))

	camera.position = _parse_vector2_param(params, "position", camera.position)
	camera.enabled = optional_bool(params, "current", true)

	if not is_existing:
		_add_child_with_undo(camera, parent, root, "MCP: Add Camera2D")

	return success({
		"node_path": str(root.get_path_to(camera)),
		"name": str(camera.name),
		"zoom": PropertyParser.serialize_value(camera.zoom),
		"is_existing": is_existing,
	})


## ─── 2. setup_parallax ─────────────────────────────────────────────────────

func _setup_parallax(params: Dictionary) -> Dictionary:
	var root := get_edited_root()
	if root == null:
		return error_no_scene()

	var parent_path: String = optional_string(params, "parent_path", ".")
	var parent := find_node_by_path(parent_path)
	if parent == null:
		return error_not_found("Parent node '%s'" % parent_path)

	var bg := ParallaxBackground.new()
	bg.name = optional_string(params, "name", "ParallaxBackground")
	_add_child_with_undo(bg, parent, root, "MCP: Add ParallaxBackground")

	var layers: Array = params.get("layers", [])
	var created: Array = []
	var idx := 0
	for layer_data in layers:
		if not (layer_data is Dictionary):
			continue
		var layer := ParallaxLayer.new()
		layer.name = str(layer_data.get("name", "ParallaxLayer%d" % idx))
		var motion_scale := float(layer_data.get("motion_scale", 1.0))
		layer.motion_scale = Vector2(motion_scale, motion_scale)
		bg.add_child(layer)
		layer.owner = root

		var tex_path := str(layer_data.get("texture", ""))
		if not tex_path.is_empty() and ResourceLoader.exists(tex_path):
			var sprite := Sprite2D.new()
			sprite.name = "Sprite"
			sprite.texture = load(tex_path) as Texture2D
			sprite.centered = false
			layer.add_child(sprite)
			sprite.owner = root
		created.append(str(layer.name))
		idx += 1

	return success({
		"node_path": str(root.get_path_to(bg)),
		"name": str(bg.name),
		"layers": created,
	})


## ─── 3. add_animated_sprite ────────────────────────────────────────────────

func _add_animated_sprite(params: Dictionary) -> Dictionary:
	var root := get_edited_root()
	if root == null:
		return error_no_scene()

	var parent_path: String = optional_string(params, "parent_path", ".")
	var parent := find_node_by_path(parent_path)
	if parent == null:
		return error_not_found("Parent node '%s'" % parent_path)

	var sheet_texture: String = optional_string(params, "sheet_texture", "")
	if sheet_texture.is_empty():
		return error_invalid_params("'sheet_texture' (res:// path) is required")
	if not ResourceLoader.exists(sheet_texture):
		return error_not_found("Texture '%s'" % sheet_texture, "Provide a valid res:// image path")

	var texture: Texture2D = load(sheet_texture) as Texture2D
	if texture == null:
		return error_invalid_params("'%s' is not a Texture2D" % sheet_texture)

	var hframes: int = max(1, optional_int(params, "hframes", 1))
	var vframes: int = max(1, optional_int(params, "vframes", 1))
	var anim_name: String = optional_string(params, "animation_name", "default")
	var fps: float = _optional_float(params, "fps", 8.0)
	var loop: bool = optional_bool(params, "loop", true)
	var autoplay: bool = optional_bool(params, "autoplay", true)

	var frame_w := int(texture.get_width() / float(hframes))
	var frame_h := int(texture.get_height() / float(vframes))

	var frames := SpriteFrames.new()
	if frames.has_animation("default") and anim_name != "default":
		frames.remove_animation("default")
	if not frames.has_animation(anim_name):
		frames.add_animation(anim_name)
	frames.set_animation_speed(anim_name, fps)
	frames.set_animation_loop(anim_name, loop)

	for y in range(vframes):
		for x in range(hframes):
			var atlas := AtlasTexture.new()
			atlas.atlas = texture
			atlas.region = Rect2(x * frame_w, y * frame_h, frame_w, frame_h)
			frames.add_frame(anim_name, atlas)

	var sprite := AnimatedSprite2D.new()
	sprite.name = optional_string(params, "name", "AnimatedSprite2D")
	sprite.sprite_frames = frames
	sprite.animation = anim_name
	sprite.autoplay = anim_name if autoplay else ""
	sprite.position = _parse_vector2_param(params, "position", Vector2.ZERO)

	_add_child_with_undo(sprite, parent, root, "MCP: Add AnimatedSprite2D")

	return success({
		"node_path": str(root.get_path_to(sprite)),
		"name": str(sprite.name),
		"animation": anim_name,
		"frame_count": hframes * vframes,
		"frame_size": {"width": frame_w, "height": frame_h},
	})


## ─── 4. setup_light_2d ─────────────────────────────────────────────────────

func _setup_light_2d(params: Dictionary) -> Dictionary:
	var root := get_edited_root()
	if root == null:
		return error_no_scene()

	var parent_path: String = optional_string(params, "parent_path", ".")
	var parent := find_node_by_path(parent_path)
	if parent == null:
		return error_not_found("Parent node '%s'" % parent_path)

	var light_type: String = optional_string(params, "light_type", "PointLight2D")
	var light: Light2D
	match light_type:
		"PointLight2D":
			var point := PointLight2D.new()
			var tex_path: String = optional_string(params, "texture", "")
			if not tex_path.is_empty() and ResourceLoader.exists(tex_path):
				point.texture = load(tex_path) as Texture2D
			light = point
		"DirectionalLight2D":
			light = DirectionalLight2D.new()
		_:
			return error_invalid_params("Unknown light_type '%s'. Available: PointLight2D, DirectionalLight2D" % light_type)

	light.name = optional_string(params, "name", light_type)
	light.energy = _optional_float(params, "energy", 1.0)
	light.color = _parse_color_param(params, "color", Color.WHITE)
	light.position = _parse_vector2_param(params, "position", Vector2.ZERO)

	_add_child_with_undo(light, parent, root, "MCP: Add %s" % light_type)

	var modulate_added := false
	if optional_bool(params, "canvas_modulate", false):
		var modulate := CanvasModulate.new()
		modulate.name = "CanvasModulate"
		modulate.color = _parse_color_param(params, "canvas_modulate_color", Color(0.2, 0.2, 0.3))
		_add_child_with_undo(modulate, root, root, "MCP: Add CanvasModulate")
		modulate_added = true

	return success({
		"node_path": str(root.get_path_to(light)),
		"name": str(light.name),
		"light_type": light_type,
		"canvas_modulate_added": modulate_added,
	})


## ─── 5. create_tileset ─────────────────────────────────────────────────────

func _create_tileset(params: Dictionary) -> Dictionary:
	var result := require_string(params, "path")
	if result[1] != null:
		return result[1]
	var path: String = result[0]

	var texture_path: String = optional_string(params, "texture", "")
	if texture_path.is_empty():
		return error_invalid_params("'texture' (res:// path to the atlas image) is required")
	if not ResourceLoader.exists(texture_path):
		return error_not_found("Texture '%s'" % texture_path)

	var tile_size: Vector2i
	var ts: Variant = params.get("tile_size", 16)
	if ts is float or ts is int:
		var s := int(ts)
		tile_size = Vector2i(s, s)
	else:
		tile_size = PropertyParser.parse_value(ts, TYPE_VECTOR2I)

	var tile_set := TileSet.new()
	tile_set.tile_shape = TileSet.TILE_SHAPE_SQUARE
	tile_set.tile_size = tile_size

	var atlas := TileSetAtlasSource.new()
	atlas.texture = load(texture_path) as Texture2D
	atlas.texture_region_size = tile_size
	# Auto-create tiles for the full atlas grid.
	var tex: Texture2D = atlas.texture
	var cols := int(tex.get_width() / float(tile_size.x))
	var rows := int(tex.get_height() / float(tile_size.y))
	for y in range(rows):
		for x in range(cols):
			atlas.create_tile(Vector2i(x, y))
	var source_id := tile_set.add_source(atlas)

	var dir_path := path.get_base_dir()
	if not DirAccess.dir_exists_absolute(dir_path):
		DirAccess.make_dir_recursive_absolute(dir_path)

	var err := ResourceSaver.save(tile_set, path)
	if err != OK:
		return error_internal("Failed to save TileSet: %s" % error_string(err))
	EditorInterface.get_resource_filesystem().scan()

	# Optionally assign to a TileMapLayer in the edited scene.
	var assigned_to := ""
	var tilemap_path: String = optional_string(params, "tilemap_node_path", "")
	if not tilemap_path.is_empty():
		var node := find_node_by_path(tilemap_path)
		if node is TileMapLayer:
			set_property_with_undo(node, "tile_set", tile_set, "MCP: Assign TileSet")
			assigned_to = tilemap_path

	return success({
		"path": path,
		"tile_size": {"x": tile_size.x, "y": tile_size.y},
		"source_id": source_id,
		"tiles_created": cols * rows,
		"assigned_to": assigned_to,
	})


## ─── 6. setup_2d_platformer_player (high-level) ────────────────────────────

func _setup_2d_platformer_player(params: Dictionary) -> Dictionary:
	var scene_path: String = optional_string(params, "scene_path", "res://scenes/player.tscn")
	var guard := guard_offline_scene_save(scene_path)
	if not guard.is_empty():
		return guard

	var speed: float = _optional_float(params, "speed", 300.0)
	var jump_velocity: float = _optional_float(params, "jump_velocity", -400.0)
	var left_action: String = optional_string(params, "left_action", "ui_left")
	var right_action: String = optional_string(params, "right_action", "ui_right")
	var jump_action: String = optional_string(params, "jump_action", "ui_accept")
	var add_camera: bool = optional_bool(params, "add_camera", true)
	var sprite_texture: String = optional_string(params, "sprite_texture", "")

	# 1. Write the movement script.
	var script_path: String = optional_string(params, "script_path", scene_path.get_basename() + ".gd")
	var script_src := _build_platformer_script(speed, jump_velocity, left_action, right_action, jump_action)
	var script_dir := script_path.get_base_dir()
	if not DirAccess.dir_exists_absolute(script_dir):
		DirAccess.make_dir_recursive_absolute(script_dir)
	var f := FileAccess.open(script_path, FileAccess.WRITE)
	if f == null:
		return error_internal("Cannot write script: %s" % error_string(FileAccess.get_open_error()))
	f.store_string(script_src)
	f.close()
	EditorInterface.get_resource_filesystem().scan()

	# 2. Build the scene tree in memory.
	var player := CharacterBody2D.new()
	player.name = "Player"

	var sprite := Sprite2D.new()
	sprite.name = "Sprite2D"
	if not sprite_texture.is_empty() and ResourceLoader.exists(sprite_texture):
		sprite.texture = load(sprite_texture) as Texture2D
	player.add_child(sprite)
	sprite.owner = player

	var collision := CollisionShape2D.new()
	collision.name = "CollisionShape2D"
	var shape := RectangleShape2D.new()
	shape.size = _parse_vector2_param(params, "collision_size", Vector2(32, 64))
	collision.shape = shape
	player.add_child(collision)
	collision.owner = player

	if add_camera:
		var camera := Camera2D.new()
		camera.name = "Camera2D"
		camera.position_smoothing_enabled = true
		player.add_child(camera)
		camera.owner = player

	# 3. Attach the script (load after filesystem scan).
	var script_res: Script = load(script_path)
	if script_res != null:
		player.set_script(script_res)

	# 4. Pack and save.
	var packed := PackedScene.new()
	var err := packed.pack(player)
	player.queue_free()
	if err != OK:
		return error_internal("Failed to pack player scene: %s" % error_string(err))

	var dir_path := scene_path.get_base_dir()
	if not DirAccess.dir_exists_absolute(dir_path):
		DirAccess.make_dir_recursive_absolute(dir_path)
	err = ResourceSaver.save(packed, scene_path)
	if err != OK:
		return error_internal("Failed to save player scene: %s" % error_string(err))
	EditorInterface.get_resource_filesystem().scan()

	if optional_bool(params, "open", true):
		EditorInterface.open_scene_from_path(scene_path)

	return success({
		"scene_path": scene_path,
		"script_path": script_path,
		"nodes": ["Player (CharacterBody2D)", "Sprite2D", "CollisionShape2D"] + (["Camera2D"] if add_camera else []),
		"input_actions": {"left": left_action, "right": right_action, "jump": jump_action},
		"suggestion": "Place this player in a level via add_scene_instance, then add ground/tilemap and call play_scene.",
	})


func _build_platformer_script(speed: float, jump_velocity: float, left_action: String, right_action: String, jump_action: String) -> String:
	return "extends CharacterBody2D\n\n" + \
		"@export var speed: float = %s\n" % str(speed) + \
		"@export var jump_velocity: float = %s\n\n" % str(jump_velocity) + \
		"var gravity: float = ProjectSettings.get_setting(\"physics/2d/default_gravity\", 980.0)\n\n" + \
		"func _physics_process(delta: float) -> void:\n" + \
		"\tif not is_on_floor():\n" + \
		"\t\tvelocity.y += gravity * delta\n\n" + \
		"\tif Input.is_action_just_pressed(\"%s\") and is_on_floor():\n" % jump_action + \
		"\t\tvelocity.y = jump_velocity\n\n" + \
		"\tvar direction := Input.get_axis(\"%s\", \"%s\")\n" % [left_action, right_action] + \
		"\tif direction != 0.0:\n" + \
		"\t\tvelocity.x = direction * speed\n" + \
		"\telse:\n" + \
		"\t\tvelocity.x = move_toward(velocity.x, 0.0, speed)\n\n" + \
		"\tmove_and_slide()\n"
