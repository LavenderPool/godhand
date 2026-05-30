import { resolve } from "path";
import { fileURLToPath } from "node:url";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const projectRoot = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  main: {
    plugins: [
      externalizeDepsPlugin({
        exclude: ["@godhand/server", "@godhand/shared", "@godhand/mcp-godot"],
      }),
    ],
    build: {
      rollupOptions: {
        input: { index: resolve(projectRoot, "src/main.ts") },
        external: ["ws", "bufferutil", "utf-8-validate", "better-sqlite3", "bindings"],
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: { index: resolve(projectRoot, "src/preload.ts") },
      },
    },
  },
  renderer: {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        "@": resolve(projectRoot, "src/renderer"),
      },
    },
    server: {
      host: "127.0.0.1",
      proxy: {
        "/api": {
          target: "http://127.0.0.1:3001",
          changeOrigin: true,
        },
      },
    },
    define: {
      __BASE_URL__: JSON.stringify(process.env.BASE_URL ?? ""),
    },
    build: {
      rollupOptions: {
        input: { index: resolve(projectRoot, "src/renderer/index.html") },
      },
    },
  },
});
