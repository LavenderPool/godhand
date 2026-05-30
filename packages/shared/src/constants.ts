export const API_VERSION = "v1";
export const API_PREFIX = `/api/${API_VERSION}`;

export const WS_BASE_PORT = 6505;
export const WS_MAX_PORT = 6514;

export const DEFAULT_SERVER_PORT = 3001;
export const DEFAULT_WEB_PORT = 3000;
export const DEFAULT_MEMORY_URL = "http://localhost:8765";

export const MCP_LOG_MAX_LINES = 100;

export const CLI_TOOL_PREFIX = "cli_";
export const CLI_TOOLS_WITH_PREFIX = new Set([
  "create_scene",
  "save_scene",
  "get_project_info",
]);

export const IMAGE_SIZES = ["256x256", "512x512", "1024x1024", "64x64"] as const;
export const IMAGE_STYLES = ["pixel-art", "cartoon", "realistic", "flat", "anime"] as const;

export type ImageSize = (typeof IMAGE_SIZES)[number];
export type ImageStyle = (typeof IMAGE_STYLES)[number];
