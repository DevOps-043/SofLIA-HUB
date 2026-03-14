import { defineConfig } from "vite";
import path from "node:path";
import { spawn, execSync, type ChildProcess } from "node:child_process";
import electron from "vite-plugin-electron/simple";
import react from "@vitejs/plugin-react";

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

// https://vitejs.dev/config/
export default defineConfig({
  server: {
    warmup: {
      clientFiles: ["./src/main.tsx", "./src/index.css"],
    },
    watch: {
      ignored: [
        '**/AUTODEV_ISSUES.md',
        '**/AUTODEV_FEEDBACK.md',
        '**/PATHS.md',
        '**/.env',
        '**/knowledge/**',
        '**/whatsapp-auth/**',
        '**/dist/**',
        '**/dist-electron/**',
      ]
    }
  },
  plugins: [
    react(),
    electron({
      main: {
        // Shortcut of `build.lib.entry`.
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
              external: (id) => {
                // Externalizar todos los módulos de node_modules que usan __dirname
                // o que son nativos/pesados para evitar problemas con ESM bundling
                const externals = [
                  "active-win",
                  "mock-aws-s3",
                  "aws-sdk",
                  "nock",
                  "node-pre-gyp",
                  "@mapbox/node-pre-gyp",
                  "@whiskeysockets/baileys",
                  "pino",
                  "qrcode",
                  "libsignal",
                  "nodemailer",
                  "googleapis",
                  "exceljs",
                  "docx",
                  "tesseract.js",
                  "@azure/msal-node",
                  "@microsoft/microsoft-graph-client",
                  "@google/generative-ai",
                  "dotenv",
                  "better-sqlite3",
                  "sharp",
                  "node-cron",
                  "systeminformation",
                  "archiver",
                ];
                // Match exact module name or subpath imports (e.g. "node-cron/something")
                return externals.some(
                  (ext) => id === ext || id.startsWith(ext + "/")
                );
              },
              output: {
                format: "es",
                entryFileNames: "[name].js",
                chunkFileNames: "[name]-[hash].js",
              },
            },
          },
        },
      },
      preload: {
        // Shortcut of `build.rollupOptions.input`.
        // Preload scripts may contain Web assets, so use the `build.rollupOptions.input` instead `build.lib.entry`.
        input: path.join(__dirname, "electron/preload.ts"),
      },
      // Ployfill the Electron and Node.js API for Renderer process.
      // If you want use Node.js in Renderer process, the `nodeIntegration` needs to be enabled in the Main process.
      // See 👉 https://github.com/electron-vite/vite-plugin-electron-renderer
      renderer:
        process.env.NODE_ENV === "test"
          ? // https://github.com/electron-vite/vite-plugin-electron-renderer/issues/78#issuecomment-2053600808
            undefined
          : {},
    }),
  ],
});
