/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import { sveltekit } from "@sveltejs/kit/vite";
import { svelteTesting } from "@testing-library/svelte/vite";

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;

// A restarted dev server asked for a component's CSS before its JS (the webview cached the JS)
// would send the raw .svelte file; compile the component first so the CSS exists.
/** @returns {import("vite").Plugin} */
function svelteCssBeforeJs() {
  /** @type {import("vite").ViteDevServer | undefined} */
  let server;
  return {
    name: "svelte-css-before-js",
    enforce: "pre",
    apply: "serve",
    configureServer(s) {
      server = s;
    },
    async load(id) {
      const [file, query = ""] = id.split("?");
      const params = new URLSearchParams(query);
      if (!file.endsWith(".svelte") || !params.has("svelte") || params.get("type") !== "style")
        return;
      await server?.transformRequest(file);
    },
  };
}

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [svelteCssBeforeJs(), sveltekit(), svelteTesting()],

  css: {
    preprocessorOptions: {
      scss: {
        loadPaths: ["src/lib/styles"],
        additionalData: `@use 'variables' as *;`,
      },
    },
  },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.ts"], // e2e/ belongs to Playwright, not Vitest
    setupFiles: ["./vitest-setup.ts"],
  },
  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },
}));
