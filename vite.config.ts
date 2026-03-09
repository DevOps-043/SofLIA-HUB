import { defineConfig } from "vite";
import path from "node:path";
import electron from "vite-plugin-electron/simple";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  server: {
    warmup: {
      clientFiles: ["./src/main.tsx", "./src/index.css"],
    },
  },
  plugins: [
    react(),
    electron({
      main: {
        entry: "electron/main.ts",
        vite: {
          build: {
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
                  // Deps opcionales de ws (usada por baileys) — no instaladas, ws usa fallback JS
                  "bufferutil",
                  "utf-8-validate",
                ];
                // Match exact module name or subpath imports (e.g. "node-cron/something")
                return externals.some(
                  (ext) => id === ext || id.startsWith(ext + "/")
                );
              },
            },
          },
        },
      },
      preload: {
        input: path.join(__dirname, "electron/preload.ts"),
      },
      renderer:
        process.env.NODE_ENV === "test"
          ? undefined
          : {},
    }),
  ],
});
