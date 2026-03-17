import { defineConfig } from "vite";
import path from "node:path";
import { spawn, execSync, type ChildProcess } from "node:child_process";
import electron from "vite-plugin-electron/simple";
import react from "@vitejs/plugin-react";
import { builtinModules } from "node:module";
import pkg from "./package.json";

type ProcessWithElectronApp = NodeJS.Process & { electronApp?: ChildProcess | null };

const electronRuntime = process as ProcessWithElectronApp;

async function stopElectronDevProcess(): Promise<void> {
  const child = electronRuntime.electronApp;
  if (!child) return;

  electronRuntime.electronApp = null;
  child.removeAllListeners();

  if (child.exitCode !== null || child.killed) {
    return;
  }

  await new Promise<void>((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      resolve();
    };

    child.once("exit", finish);

    try {
      if (!child.pid) {
        finish();
        return;
      }

      if (process.platform === "win32") {
        execSync(`taskkill /pid ${child.pid} /T /F`, { stdio: "ignore" });
      } else {
        child.kill("SIGTERM");
      }
    } catch {
      finish();
    }

    setTimeout(finish, 2000);
  });
}

async function startElectronDevProcess(argv = [".", "--no-sandbox"]): Promise<void> {
  const electronModule = await import("electron");
  const electronPath = electronModule.default ?? electronModule;

  await stopElectronDevProcess();

  const child = spawn(electronPath as string, argv, {
    stdio: ["inherit", "inherit", "inherit", "ipc"],
  });

  electronRuntime.electronApp = child;
  child.once("exit", () => {
    if (electronRuntime.electronApp === child) {
      electronRuntime.electronApp = null;
      process.exit();
    }
  });
}

function isIgnorableRollupWarning(warning: { code?: string; message: string; id?: string }): boolean {
  if (
    warning.code === "UNUSED_EXTERNAL_IMPORT" &&
    warning.message.includes('"WriteStream" is imported from external module "fs" but never used')
  ) {
    return true;
  }

  if (
    warning.code === "EVAL" &&
    warning.message.includes('Use of eval in "node_modules/@protobufjs/inquire/index.js"')
  ) {
    return true;
  }

  return false;
}

export default defineConfig({
  server: {
    warmup: {
      clientFiles: ["./src/main.tsx", "./src/index.css"],
    },
    watch: {
      ignored: ["**/dist/**", "**/dist-electron/**"],
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
              onwarn(warning, warn) {
                if (isIgnorableRollupWarning(warning)) {
                  return;
                }
                warn(warning);
              },
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
