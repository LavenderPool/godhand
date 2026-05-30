@tool
extends Node

## Single-connection WebSocket client routed by GodHand projectId.
## Connects to ws://127.0.0.1:6505/ws/{projectId}

signal client_connected()
signal client_disconnected()
signal message_received(text: String)
signal command_executed(method: String, success: bool)
signal command_completed(method: String, success: bool, response: String, source_port: int)

var command_router: Node

const DEFAULT_HOST := "127.0.0.1"
const DEFAULT_PORT := 6505
const RECONNECT_INTERVAL := 3.0
const BUFFER_SIZE := 16 * 1024 * 1024
const PING_INTERVAL := 5.0
const INACTIVITY_TIMEOUT := 30.0

var _project_id: String = ""
var _relay_url: String = ""
var _peer: WebSocketPeer = null
var _connected: bool = false
var _reconnect_timer: float = 0.0
var _connect_time: float = 0.0
var _last_activity: float = 0.0
var _ping_timer: float = 0.0
var _stale: bool = false
var _running: bool = false


func start_server() -> void:
	_running = true
	if not _load_project_config():
		push_error("[MCP] Missing .godhand/project.json — register project in GodHand first")
		return
	_try_connect()
	print("[MCP] Connecting to %s" % _relay_url)


func stop_server() -> void:
	_running = false
	if _peer:
		_peer.close(1000, "Plugin shutting down")
	_peer = null
	_connected = false
	_stale = false
	print("[MCP] WebSocket client stopped")


func get_client_count() -> int:
	return 1 if _connected else 0


func get_connected_ports() -> Array[int]:
	return [DEFAULT_PORT] if _connected else []


func get_port_connect_time(_port: int) -> float:
	return _connect_time if _connected else -1.0


func get_port_idle_time(_port: int) -> float:
	return _last_activity if _connected else -1.0


func is_port_stale(_port: int) -> bool:
	return _stale


func get_project_id() -> String:
	return _project_id


func get_relay_url() -> String:
	return _relay_url


func _load_project_config() -> bool:
	var project_root := ProjectSettings.globalize_path("res://")
	if not project_root.ends_with("/") and not project_root.ends_with("\\"):
		project_root += "/"

	var config_path := project_root + ".godhand/project.json"
	if not FileAccess.file_exists(config_path):
		return false

	var file := FileAccess.open(config_path, FileAccess.READ)
	if file == null:
		return false

	var parsed: Variant = JSON.parse_string(file.get_as_text())
	if not parsed is Dictionary:
		return false

	var config: Dictionary = parsed
	_project_id = str(config.get("projectId", ""))
	_relay_url = str(config.get("relayUrl", ""))

	if _project_id.is_empty():
		return false

	if _relay_url.is_empty():
		_relay_url = "ws://%s:%d/ws/%s" % [DEFAULT_HOST, DEFAULT_PORT, _project_id]

	return true


func _try_connect() -> void:
	if _relay_url.is_empty():
		return

	_peer = WebSocketPeer.new()
	_peer.outbound_buffer_size = BUFFER_SIZE
	_peer.inbound_buffer_size = BUFFER_SIZE
	var err := _peer.connect_to_url(_relay_url)
	if err != OK:
		_peer = null


func _process(delta: float) -> void:
	if not _running:
		return

	if _peer == null:
		_reconnect_timer += delta
		if _reconnect_timer >= RECONNECT_INTERVAL:
			_reconnect_timer = 0.0
			_try_connect()
		return

	_peer.poll()
	var state := _peer.get_ready_state()

	match state:
		WebSocketPeer.STATE_OPEN:
			if not _connected:
				_connected = true
				_connect_time = 0.0
				_last_activity = 0.0
				_ping_timer = 0.0
				_stale = false
				_reconnect_timer = 0.0
				print_verbose("[MCP] Connected to %s" % _relay_url)
				client_connected.emit()
			else:
				_connect_time += delta
				_last_activity += delta
				_ping_timer += delta

			var received_any := false
			while _peer.get_available_packet_count() > 0:
				var packet := _peer.get_packet()
				var text := packet.get_string_from_utf8()
				received_any = true
				_dispatch_message(text, DEFAULT_PORT)

			if received_any:
				_last_activity = 0.0
				if _stale:
					_stale = false
					print("[MCP] Recovered from stale state")

			if _last_activity > INACTIVITY_TIMEOUT:
				push_warning("[MCP] Silent for %.1fs — forcing reconnect" % _last_activity)
				_stale = true
				_peer.close(4000, "Heartbeat timeout")
				_connected = false
				_peer = null
				_reconnect_timer = 0.0
				client_disconnected.emit()
				return

			if _ping_timer >= PING_INTERVAL:
				_ping_timer = 0.0
				_peer.send_text(JSON.stringify({"jsonrpc": "2.0", "method": "ping", "params": {}}))

		WebSocketPeer.STATE_CLOSING:
			pass

		WebSocketPeer.STATE_CLOSED:
			if _connected:
				_connected = false
				print_verbose("[MCP] Disconnected from %s" % _relay_url)
				client_disconnected.emit()
			_peer = null
			_reconnect_timer = 0.0
			_last_activity = 0.0
			_ping_timer = 0.0

		WebSocketPeer.STATE_CONNECTING:
			pass


func _send_to_port(_port: int, text: String) -> void:
	if _peer and _connected:
		_peer.send_text(text)


func send_message(text: String) -> void:
	_send_to_port(DEFAULT_PORT, text)


func _dispatch_message(text: String, source_port: int) -> void:
	message_received.emit(text)

	var json := JSON.new()
	var err := json.parse(text)
	if err != OK:
		_send_response(source_port, null, null, {"code": -32700, "message": "Parse error"})
		return

	var msg: Variant = json.data
	if not msg is Dictionary:
		_send_response(source_port, null, null, {"code": -32600, "message": "Invalid request"})
		return

	var msg_dict: Dictionary = msg

	if msg_dict.get("method") == "ping":
		_send_to_port(source_port, JSON.stringify({"jsonrpc": "2.0", "method": "pong", "params": {}}))
		return

	if msg_dict.get("method") == "pong":
		return

	var id: Variant = msg_dict.get("id")
	var method: String = msg_dict.get("method", "")
	var params: Dictionary = msg_dict.get("params", {})

	if method.is_empty():
		_send_response(source_port, id, null, {"code": -32600, "message": "Missing method"})
		return

	if not command_router:
		_send_response(source_port, id, null, {"code": -32603, "message": "No command router"})
		return

	_execute_command.call_deferred(source_port, id, method, params)


func _execute_command(source_port: int, id: Variant, method: String, params: Dictionary) -> void:
	var cmd_result: Dictionary = await command_router.execute(method, params)
	if cmd_result.has("error"):
		var err_data: Variant = cmd_result["error"]
		_send_response(source_port, id, null, err_data)
		var response_text := JSON.stringify(err_data)
		command_executed.emit(method, false)
		command_completed.emit(method, false, response_text, source_port)
	else:
		var result_data: Variant = cmd_result.get("result", {})
		_send_response(source_port, id, result_data, null)
		var response_text := JSON.stringify(result_data)
		command_executed.emit(method, true)
		command_completed.emit(method, true, response_text, source_port)


func _send_response(source_port: int, id: Variant, result: Variant, err: Variant) -> void:
	var response: Dictionary = {"jsonrpc": "2.0", "id": id}
	if err != null:
		response["error"] = err
	else:
		response["result"] = result if result != null else {}
	_send_to_port(source_port, JSON.stringify(response))
