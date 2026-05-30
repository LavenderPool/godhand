@tool
extends "res://addons/godot_mcp/commands/base_command.gd"

const PropertyParser := preload("res://addons/godot_mcp/utils/property_parser.gd")


func get_commands() -> Dictionary:
	return {
		"setup_csg": _setup_csg,
		"add_multimesh": _add_multimesh,
		"add_reflection_probe": _add_reflection_probe,
		"add_decal": _add_decal,
		"setup_3d_character": _setup_3d_character,
	}


## ─── Helpers ───────────────────────────────────────────────────────────────

func _optional_float(params: Dictionary, key: String, default: float) -> float:
	if params.has(key):
		return float(params[key])
	return default


func _parse_vector3_param(params: Dictionary, key: String, default: Vector3) -> Vector3:
	if not params.has(key):
		return default
	return PropertyParser.parse_value(params[key], TYPE_VECTOR3)


func _add_child_with_undo(node: Node, parent: Node, root: Node, action_name: String) -> void:
	var undo_redo := get_undo_redo()
	undo_redo.create_action(action_name)
	undo_redo.add_do_method(parent, "add_child", node)
	undo_redo.add_do_method(node, "set_owner", root)
	undo_redo.add_do_reference(node)
	undo_redo.add_undo_method(parent, "remove_child", node)
	undo_redo.commit_action()


const _PRIMITIVE_MESHES := {
	"BoxMesh": BoxMesh,
	"SphereMesh": SphereMesh,
	"CylinderMesh": CylinderMesh,
	"CapsuleMesh": CapsuleMesh,
	"PlaneMesh": PlaneMesh,
	"QuadMesh": QuadMesh,
}


## ─── 1. setup_csg ──────────────────────────────────────────────────────────

func _setup_csg(params: Dictionary) -> Dictionary:
	var root := get_edited_root()
	if root == null:
		return error_no_scene()

	var parent_path: String = optional_string(params, "parent_path", ".")
	var parent := find_node_by_path(parent_path)
	if parent == null:
		return error_not_found("Parent node '%s'" % parent_path)

	var csg_type: String = optional_string(params, "csg_type", "CSGBox3D")
	if not ClassDB.class_exists(csg_type) or not ClassDB.is_parent_class(csg_type, "CSGShape3D"):
		return error_invalid_params("Unknown csg_type '%s'. Available: CSGBox3D, CSGSphere3D, CSGCylinder3D, CSGTorus3D, CSGMesh3D, CSGCombiner3D" % csg_type)

	var node: CSGShape3D = ClassDB.instantiate(csg_type)
	node.name = optional_string(params, "name", csg_type)

	var op: String = optional_string(params, "operation", "union")
	match op:
		"union":
			node.operation = CSGShape3D.OPERATION_UNION
		"intersection":
			node.operation = CSGShape3D.OPERATION_INTERSECTION
		"subtraction":
			node.operation = CSGShape3D.OPERATION_SUBTRACTION

	if node is CSGBox3D and params.has("size"):
		(node as CSGBox3D).size = _parse_vector3_param(params, "size", Vector3.ONE)
	elif node is CSGSphere3D and params.has("radius"):
		(node as CSGSphere3D).radius = _optional_float(params, "radius", 0.5)

	node.position = _parse_vector3_param(params, "position", Vector3.ZERO)
	node.use_collision = optional_bool(params, "use_collision", true)

	_add_child_with_undo(node, parent, root, "MCP: Add %s" % csg_type)

	return success({
		"node_path": str(root.get_path_to(node)),
		"name": str(node.name),
		"csg_type": csg_type,
		"operation": op,
	})


## ─── 2. add_multimesh ──────────────────────────────────────────────────────

func _add_multimesh(params: Dictionary) -> Dictionary:
	var root := get_edited_root()
	if root == null:
		return error_no_scene()

	var parent_path: String = optional_string(params, "parent_path", ".")
	var parent := find_node_by_path(parent_path)
	if parent == null:
		return error_not_found("Parent node '%s'" % parent_path)

	var mesh_type: String = optional_string(params, "mesh_type", "BoxMesh")
	if not _PRIMITIVE_MESHES.has(mesh_type):
		var mesh_file := optional_string(params, "mesh_file", "")
		if mesh_file.is_empty():
			return error_invalid_params("Unknown mesh_type '%s' and no mesh_file provided" % mesh_type)

	var count: int = max(1, optional_int(params, "instance_count", 100))

	var mm := MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	if _PRIMITIVE_MESHES.has(mesh_type):
		mm.mesh = _PRIMITIVE_MESHES[mesh_type].new()
	else:
		var loaded: Resource = load(optional_string(params, "mesh_file", ""))
		if loaded is Mesh:
			mm.mesh = loaded as Mesh
	mm.instance_count = count

	# Distribute instances randomly within an area (override later as needed).
	var area := _parse_vector3_param(params, "area", Vector3(20, 0, 20))
	var rng := RandomNumberGenerator.new()
	rng.seed = optional_int(params, "seed", 0)
	for i in range(count):
		var xform := Transform3D.IDENTITY
		xform.origin = Vector3(
			rng.randf_range(-area.x * 0.5, area.x * 0.5),
			rng.randf_range(0.0, area.y),
			rng.randf_range(-area.z * 0.5, area.z * 0.5)
		)
		mm.set_instance_transform(i, xform)

	var node := MultiMeshInstance3D.new()
	node.name = optional_string(params, "name", "MultiMeshInstance3D")
	node.multimesh = mm
	node.position = _parse_vector3_param(params, "position", Vector3.ZERO)

	_add_child_with_undo(node, parent, root, "MCP: Add MultiMeshInstance3D")

	return success({
		"node_path": str(root.get_path_to(node)),
		"name": str(node.name),
		"instance_count": count,
		"mesh_type": mesh_type,
	})


## ─── 3. add_reflection_probe ───────────────────────────────────────────────

func _add_reflection_probe(params: Dictionary) -> Dictionary:
	var root := get_edited_root()
	if root == null:
		return error_no_scene()

	var parent_path: String = optional_string(params, "parent_path", ".")
	var parent := find_node_by_path(parent_path)
	if parent == null:
		return error_not_found("Parent node '%s'" % parent_path)

	var probe := ReflectionProbe.new()
	probe.name = optional_string(params, "name", "ReflectionProbe")
	probe.size = _parse_vector3_param(params, "size", Vector3(20, 20, 20))
	probe.position = _parse_vector3_param(params, "position", Vector3.ZERO)
	if optional_bool(params, "interior", false):
		probe.interior = true

	_add_child_with_undo(probe, parent, root, "MCP: Add ReflectionProbe")

	return success({
		"node_path": str(root.get_path_to(probe)),
		"name": str(probe.name),
	})


## ─── 4. add_decal ──────────────────────────────────────────────────────────

func _add_decal(params: Dictionary) -> Dictionary:
	var root := get_edited_root()
	if root == null:
		return error_no_scene()

	var parent_path: String = optional_string(params, "parent_path", ".")
	var parent := find_node_by_path(parent_path)
	if parent == null:
		return error_not_found("Parent node '%s'" % parent_path)

	var decal := Decal.new()
	decal.name = optional_string(params, "name", "Decal")
	decal.size = _parse_vector3_param(params, "size", Vector3(2, 2, 2))
	decal.position = _parse_vector3_param(params, "position", Vector3.ZERO)

	var tex_path: String = optional_string(params, "texture", "")
	if not tex_path.is_empty():
		if not ResourceLoader.exists(tex_path):
			decal.queue_free()
			return error_not_found("Texture '%s'" % tex_path)
		decal.texture_albedo = load(tex_path) as Texture2D

	_add_child_with_undo(decal, parent, root, "MCP: Add Decal")

	return success({
		"node_path": str(root.get_path_to(decal)),
		"name": str(decal.name),
		"has_texture": decal.texture_albedo != null,
	})


## ─── 5. setup_3d_character (high-level) ────────────────────────────────────

func _setup_3d_character(params: Dictionary) -> Dictionary:
	var scene_path: String = optional_string(params, "scene_path", "res://scenes/player.tscn")
	var guard := guard_offline_scene_save(scene_path)
	if not guard.is_empty():
		return guard

	var mesh_type: String = optional_string(params, "mesh_type", "CapsuleMesh")
	if not _PRIMITIVE_MESHES.has(mesh_type):
		mesh_type = "CapsuleMesh"
	var speed: float = _optional_float(params, "speed", 5.0)
	var jump_velocity: float = _optional_float(params, "jump_velocity", 4.5)
	var add_camera: bool = optional_bool(params, "add_camera", true)

	# 1. Movement script.
	var script_path: String = optional_string(params, "script_path", scene_path.get_basename() + ".gd")
	var script_src := _build_character_script(speed, jump_velocity)
	var script_dir := script_path.get_base_dir()
	if not DirAccess.dir_exists_absolute(script_dir):
		DirAccess.make_dir_recursive_absolute(script_dir)
	var f := FileAccess.open(script_path, FileAccess.WRITE)
	if f == null:
		return error_internal("Cannot write script: %s" % error_string(FileAccess.get_open_error()))
	f.store_string(script_src)
	f.close()
	EditorInterface.get_resource_filesystem().scan()

	# 2. Build tree.
	var player := CharacterBody3D.new()
	player.name = "Player"

	var mesh_inst := MeshInstance3D.new()
	mesh_inst.name = "MeshInstance3D"
	mesh_inst.mesh = _PRIMITIVE_MESHES[mesh_type].new()
	player.add_child(mesh_inst)
	mesh_inst.owner = player

	var collision := CollisionShape3D.new()
	collision.name = "CollisionShape3D"
	var shape := CapsuleShape3D.new()
	collision.shape = shape
	player.add_child(collision)
	collision.owner = player

	if add_camera:
		var arm := SpringArm3D.new()
		arm.name = "SpringArm3D"
		arm.spring_length = _optional_float(params, "camera_distance", 4.0)
		arm.position = Vector3(0, 1.5, 0)
		player.add_child(arm)
		arm.owner = player
		var camera := Camera3D.new()
		camera.name = "Camera3D"
		camera.current = true
		arm.add_child(camera)
		camera.owner = player

	# 3. Script.
	var script_res: Script = load(script_path)
	if script_res != null:
		player.set_script(script_res)

	# 4. Pack and save.
	var packed := PackedScene.new()
	var err := packed.pack(player)
	player.queue_free()
	if err != OK:
		return error_internal("Failed to pack character scene: %s" % error_string(err))

	var dir_path := scene_path.get_base_dir()
	if not DirAccess.dir_exists_absolute(dir_path):
		DirAccess.make_dir_recursive_absolute(dir_path)
	err = ResourceSaver.save(packed, scene_path)
	if err != OK:
		return error_internal("Failed to save character scene: %s" % error_string(err))
	EditorInterface.get_resource_filesystem().scan()

	if optional_bool(params, "open", true):
		EditorInterface.open_scene_from_path(scene_path)

	return success({
		"scene_path": scene_path,
		"script_path": script_path,
		"nodes": ["Player (CharacterBody3D)", "MeshInstance3D", "CollisionShape3D"] + (["SpringArm3D", "Camera3D"] if add_camera else []),
		"suggestion": "Place this character in a Node3D level (setup_csg blockout + setup_lighting + setup_environment), then play_scene.",
	})


func _build_character_script(speed: float, jump_velocity: float) -> String:
	return "extends CharacterBody3D\n\n" + \
		"@export var speed: float = %s\n" % str(speed) + \
		"@export var jump_velocity: float = %s\n\n" % str(jump_velocity) + \
		"var gravity: float = ProjectSettings.get_setting(\"physics/3d/default_gravity\", 9.8)\n\n" + \
		"func _physics_process(delta: float) -> void:\n" + \
		"\tif not is_on_floor():\n" + \
		"\t\tvelocity.y -= gravity * delta\n\n" + \
		"\tif Input.is_action_just_pressed(\"ui_accept\") and is_on_floor():\n" + \
		"\t\tvelocity.y = jump_velocity\n\n" + \
		"\tvar input_dir := Input.get_vector(\"ui_left\", \"ui_right\", \"ui_up\", \"ui_down\")\n" + \
		"\tvar direction := (transform.basis * Vector3(input_dir.x, 0.0, input_dir.y)).normalized()\n" + \
		"\tif direction:\n" + \
		"\t\tvelocity.x = direction.x * speed\n" + \
		"\t\tvelocity.z = direction.z * speed\n" + \
		"\telse:\n" + \
		"\t\tvelocity.x = move_toward(velocity.x, 0.0, speed)\n" + \
		"\t\tvelocity.z = move_toward(velocity.z, 0.0, speed)\n\n" + \
		"\tmove_and_slide()\n"
