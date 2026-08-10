import { defineConfig, loadEnv } from "vite";
import path from "node:path";
import electron from "vite-plugin-electron/simple";
import react from "@vitejs/plugin-react";
import pkg from "./package.json" with { type: "json" };
import { createElectronExternals, onElectronRollupWarning } from "./config/vite/electron-build.mjs";
import { startElectronDevProcess } from "./config/vite/dev-electron-process.mjs";
import { createMainProcessEnvDefines } from "./config/vite/env-defines.mjs";

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
  // Las credenciales ElevenLabs solo se incrustan en el bundle main. No usan
  // el prefijo VITE_ y por tanto no forman parte de import.meta.env ni del
  // renderer/preload.
  const elevenLabsEnv = loadEnv(mode, process.cwd(), "ELEVENLABS_");
  const mainProcessEnvDefines = createMainProcessEnvDefines({ ...env, ...elevenLabsEnv });
  const preloadEnvDefines = createMainProcessEnvDefines(env);

  return {
    // El renderer conserva un unico prefijo publico: VITE_. Las variables
    // main-only de ElevenLabs se cargan por separado arriba y nunca pasan por
    // `envPrefix`, import.meta.env ni el bundle preload.
    envPrefix: "VITE_",
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
              rolldownOptions: {
                external: createElectronExternals(pkg.dependencies),
                onwarn: onElectronRollupWarning,
              },
            },
          },
        },
        preload: {
          input: path.join(import.meta.dirname, "electron/preload.ts"),
          vite: {
            define: preloadEnvDefines,
            build: {
              rolldownOptions: {
                external: createElectronExternals(pkg.dependencies),
                onwarn: onElectronRollupWarning,
              },
            },
          },
        },
        renderer: {},
      }),
    ],
  };
});
