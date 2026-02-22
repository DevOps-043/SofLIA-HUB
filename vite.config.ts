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
        // Shortcut of `build.lib.entry`.
        entry: "electron/main.ts",
        vite: {
          build: {
            rollupOptions: {
              external: [
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
              ],
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
