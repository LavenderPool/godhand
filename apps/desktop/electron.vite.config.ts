import { resolve } from "path";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";

export default defineConfig({
  main: {
    plugins: [
      externalizeDepsPlugin({
        exclude: ["@godhand/server", "@godhand/db", "@godhand/shared", "@godhand/mcp-godot"],
      }),
    ],
    build: {
      rollupOptions: {
        input: { index: resolve(__dirname, "src/main.ts") },
        external: ["ws", "bufferutil", "utf-8-validate"],
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: { index: resolve(__dirname, "src/preload.ts") },
      },
    },
  },
});
