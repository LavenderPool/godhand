@tool
extends "res://addons/godot_mcp/commands/base_command.gd"


func get_commands() -> Dictionary:
	return {
		"list_ios_targets": _list_ios_targets,
		"get_ios_preset_info": _get_ios_preset_info,
		"export_ios": _export_ios,
	}


func _run(cmd: String, args: PackedStringArray) -> Dictionary:
	var output: Array = []
	var exit_code := OS.execute(cmd, args, output, true)
	var stdout := ""
	if not output.is_empty():
		stdout = str(output[0])
	return {"exit_code": exit_code, "stdout": stdout}


## Find an iOS preset in export_presets.cfg. Returns the preset dict or empty.
func _find_ios_preset(preset_name: String, preset_index: int) -> Dictionary:
	var presets_path := "res://export_presets.cfg"
	if not FileAccess.file_exists(presets_path):
		return {}
	var cfg := ConfigFile.new()
	if cfg.load(presets_path) != OK:
		return {}

	var idx := 0
	while cfg.has_section("preset.%d" % idx):
		var section := "preset.%d" % idx
		var platform := str(cfg.get_value(section, "platform", ""))
		var name := str(cfg.get_value(section, "name", ""))
		var matches := false
		if not preset_name.is_empty():
			matches = (name == preset_name)
		elif preset_index >= 0:
			matches = (idx == preset_index)
		else:
			matches = (platform == "iOS")
		if matches:
			var options_section := "preset.%d.options" % idx
			var bundle_id := ""
			if cfg.has_section(options_section):
				bundle_id = str(cfg.get_value(options_section, "application/bundle_identifier", ""))
			return {
				"index": idx,
				"name": name,
				"platform": platform,
				"runnable": bool(cfg.get_value(section, "runnable", false)),
				"export_path": str(cfg.get_value(section, "export_path", "")),
				"bundle_identifier": bundle_id,
			}
		idx += 1
	return {}


## List connected iOS targets (best-effort; requires macOS tooling).
func _list_ios_targets(_params: Dictionary) -> Dictionary:
	if OS.get_name() != "macOS":
		return success({
			"targets": [],
			"count": 0,
			"host_os": OS.get_name(),
			"note": "iOS device listing requires macOS with Xcode command line tools.",
		})
	var result := _run("xcrun", PackedStringArray(["xctrace", "list", "devices"]))
	return success({
		"targets_raw": result["stdout"],
		"exit_code": result["exit_code"],
		"host_os": OS.get_name(),
	})


## Read iOS export preset metadata (bundle id, export path, etc.)
func _get_ios_preset_info(params: Dictionary) -> Dictionary:
	var preset_name: String = optional_string(params, "preset_name", "")
	var preset_index: int = optional_int(params, "preset_index", -1)
	var preset := _find_ios_preset(preset_name, preset_index)
	if preset.is_empty():
		return error_not_found("iOS export preset", "Configure an iOS preset in Project > Export first.")
	if preset["platform"] != "iOS":
		return error(-32000, "Preset '%s' is not an iOS preset (platform=%s)" % [preset["name"], preset["platform"]])
	return success(preset)


## Headless-export an iOS Xcode project / IPA for a preset.
## Building a signed IPA requires macOS + Xcode; on other hosts the Xcode
## project can still be generated but cannot be compiled.
func _export_ios(params: Dictionary) -> Dictionary:
	var preset_name: String = optional_string(params, "preset_name", "")
	var preset_index: int = optional_int(params, "preset_index", -1)
	var debug: bool = optional_bool(params, "debug", true)

	var preset := _find_ios_preset(preset_name, preset_index)
	if preset.is_empty():
		return error_not_found("iOS export preset", "Configure an iOS preset in Project > Export first.")
	if preset["platform"] != "iOS":
		return error(-32000, "Preset '%s' is not an iOS preset" % preset["name"])

	var export_path_res: String = preset["export_path"]
	if export_path_res.is_empty():
		return error(-32000, "Export path not configured for preset '%s'" % preset["name"])
	var export_path_abs: String = ProjectSettings.globalize_path(export_path_res) if export_path_res.begins_with("res://") else export_path_res

	var host_os := OS.get_name()
	var note := ""
	if host_os != "macOS":
		note = "Host is %s: Godot generated the Xcode project, but compiling/signing an IPA requires macOS + Xcode." % host_os

	var godot_bin := OS.get_executable_path()
	var project_dir := ProjectSettings.globalize_path("res://")
	var export_flag := "--export-debug" if debug else "--export-release"

	var out_dir := export_path_abs.get_base_dir()
	if not out_dir.is_empty() and not DirAccess.dir_exists_absolute(out_dir):
		DirAccess.make_dir_recursive_absolute(out_dir)

	if optional_bool(params, "dry_run", false):
		return success({
			"preset": preset["name"],
			"export_path": export_path_abs,
			"host_os": host_os,
			"dry_run": true,
			"note": note,
		})

	var args := PackedStringArray(["--headless", "--path", project_dir, export_flag, preset["name"], export_path_abs])
	var result := _run(godot_bin, args)
	if result["exit_code"] != 0:
		return error(-32000, "iOS export failed (exit %d)." % result["exit_code"], {
			"output": result["stdout"],
			"host_os": host_os,
			"suggestion": "Install the iOS export template and verify the preset. " + note,
		})

	return success({
		"preset": preset["name"],
		"export_path": export_path_abs,
		"bundle_identifier": preset["bundle_identifier"],
		"exported": FileAccess.file_exists(export_path_abs) or DirAccess.dir_exists_absolute(export_path_abs),
		"host_os": host_os,
		"note": note,
	})
