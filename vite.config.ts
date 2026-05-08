import { defineConfig, loadEnv } from "vite";
import path from "node:path";
import electron from "vite-plugin-electron/simple";
import react from "@vitejs/plugin-react";
import pkg from "./package.json";
import { createElectronExternals, onElectronRollupWarning } from "./config/vite/electron-build";
import { startElectronDevProcess } from "./config/vite/dev-electron-process";
import { createMainProcessEnvDefines } from "./config/vite/env-defines";

const OPTIMIZE_DEP_EXCLUDES = [
  "mammoth",
  "pptxgenjs",
  "archiver",
  "better-sqlite3",
  "sharp",
  "exceljs",
  "docx",
];

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  const mainProcessEnvDefines = createMainProcessEnvDefines(env);

  return {
    server: {
      warmup: {
        clientFiles: ["./src/main.tsx", "./src/index.css"],
      },
      watch: {
        ignored: ["**/dist/**", "**/dist-electron/**"],
      },
    },
    optimizeDeps: {
      exclude: OPTIMIZE_DEP_EXCLUDES,
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
            define: mainProcessEnvDefines,
            build: {
              lib: {
                entry: "electron/main.ts",
                formats: ["cjs"],
                fileName: () => "[name].js",
              },
              rollupOptions: {
                external: createElectronExternals(pkg.dependencies),
                onwarn: onElectronRollupWarning,
              },
            },
          },
        },
        preload: {
          input: path.join(__dirname, "electron/preload.ts"),
          vite: {
            define: mainProcessEnvDefines,
          },
        },
        renderer: {},
      }),
    ],
  };
});
