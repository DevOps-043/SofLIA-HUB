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
      // La vista previa se ejecuta en un iframe sandbox sin same-origin. En
      // desarrollo su origen es opaco (`null`). Los modulos de Vite tambien
      // los consume el renderer en `localhost`; una cabecera fija se almacena
      // en cache con el origen equivocado y deja el iframe en blanco. Estos
      // son assets publicos de desarrollo, asi que `*` cubre ambos origenes
      // sin habilitar credenciales ni alterar el runtime de produccion.
      headers: {
        "Access-Control-Allow-Origin": "*",
        // Electron reutiliza la sesion entre reinicios. Sin esta cabecera
        // puede conservar un modulo con una respuesta CORS antigua y dejar
        // en blanco la vista previa incluso despues de corregir el servidor.
        "Cache-Control": "no-store",
      },
      cors: true,
      warmup: {
        clientFiles: ["./src/main.tsx", "./src/index.css"],
      },
      watch: {
        // Las capturas HAR se escriben por streaming y Windows las mantiene
        // bloqueadas. Chokidar intentaba observarlas y derribaba `npm run dev`
        // con EBUSY justo despues de reproducir una llamada de Meet.
        ignored: ["**/dist/**", "**/dist-electron/**", "**/*.har", "**/mailsoflia*.google.com"],
      },
    },
    preview: {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-store",
      },
      cors: true,
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
            await startElectronDevProcess(['.', '--no-sandbox'], {
              // vite-plugin-electron publica este valor antes de ejecutar
              // `onstart`; lo pasamos de forma explicita al hijo Electron.
              devServerUrl: process.env.VITE_DEV_SERVER_URL,
            });
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
