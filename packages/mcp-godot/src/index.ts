#!/usr/bin/env node
import { McpGodotServer } from "./mcp-server.js";

const isStdio = process.argv.includes("--stdio") || !process.env.MCP_HTTP;

async function main() {
  const projectId = process.env.PROJECT_ID;
  if (!projectId) {
    console.error("PROJECT_ID env var is required");
    process.exit(1);
  }

  const relayMode = process.env.WS_RELAY_MODE as "local" | "remote" | undefined;
  const apiUrl = process.env.GODHAND_API_URL;

  const server = new McpGodotServer({
    projectId,
    godotPath: process.env.GODOT_PATH,
    relayMode,
    apiUrl,
  });

  if (isStdio) {
    await server.startStdio();
  } else {
    console.log(`GodHand MCP server ready. Project: ${projectId}, relay: ${server.getStatus().relayUrl}`);
    await server.startStdio();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
