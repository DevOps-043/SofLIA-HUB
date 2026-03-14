import { defineConfig } from "vite";
import path from "node:path";
import { spawn, execSync, type ChildProcess } from "node:child_process";
import electron from "vite-plugin-electron/simple";
import react from "@vitejs/plugin-react";
import { builtinModules } from "node:module";
import pkg from "./package.json";

export default defineConfig({
  server: {
    warmup: {
      clientFiles: ["./src/main.tsx", "./src/index.css"],
    },
  },
  optimizeDeps: {
    exclude: ["mammoth", "pptxgenjs", "archiver", "better-sqlite3", "sharp", "exceljs", "docx"],
  },
  plugins: [
    react(),
    electron({
      main: {
        entry: "electron/main.ts",
        onstart: async () => {
          await startElectronDevProcess();
        },
        vite: {
          build: {
            // Override vite-plugin-electron's auto-detection of "type":"module"
            // to output CJS instead of ESM — avoids Node 20 cjsPreparseModuleExports crash
            // with externalized CJS native modules (better-sqlite3, baileys, etc.)
            lib: {
              entry: "electron/main.ts",
              formats: ["es"],
              fileName: () => "[name].js",
            },
            rollupOptions: {
              external: [
                ...builtinModules,
                ...builtinModules.map((m) => `node:${m}`),
                // Externalizamos todo EXCEPTO Baileys para evitar el error ERR_REQUIRE_ESM
                ...Object.keys(pkg.dependencies || {}).filter(dep => dep !== "@whiskeysockets/baileys"),
                "bufferutil",
                "utf-8-validate",
              ],
            },
          },
        },
      },
      preload: {
        input: path.join(__dirname, "electron/preload.ts"),
      },
      renderer: {},
    }),
  ],
});
