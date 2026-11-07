import { createServer } from "vite";
import react from "@vitejs/plugin-react";
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { _electron } from "playwright-core";

const require = createRequire(import.meta.url);
const root = process.cwd();
const reports = resolve(
  root,
  "openspec/changes/add-portable-project-workspaces/reports",
);
// No carga el config Electron ni los archivos .env de la aplicación.
const server = await createServer({
  configFile: false,
  root,
  envDir: resolve(root, "test/manual/project-panel"),
  plugins: [react()],
  optimizeDeps: { entries: ["test/manual/project-panel/index.html"] },
  server: { host: "127.0.0.1", port: 0 },
});
await server.listen();
const port = server.httpServer.address().port;
let app;
try {
  await mkdir(reports, { recursive: true });
  app = await _electron.launch({
    executablePath: require("electron"),
    args: [resolve(root, "test/manual/project-panel/electron.cjs")],
    env: {
      ...process.env,
      PROJECT_PANEL_PREVIEW_URL: `http://127.0.0.1:${port}/test/manual/project-panel/index.html`,
    },
  });
  const page = await app.firstWindow();
  const capture = async (name) => {
    await page.evaluate(() => document.fonts.ready.then(() => undefined));
    const png = await app.evaluate(async ({ BrowserWindow }) => {
      const image =
        await BrowserWindow.getAllWindows()[0].webContents.capturePage(
          undefined,
          { stayHidden: true, stayAwake: true },
        );
      return image.toPNG().toString("base64");
    });
    await writeFile(resolve(reports, name), Buffer.from(png, "base64"));
  };
  await page.getByRole("heading", { name: "Lanzamiento Soflia" }).waitFor();
  await page.getByText("24 de 36 tareas").waitFor();
  await capture("panel-implemented-light.png");
  await page.getByRole("button", { name: "Páginas web", exact: true }).click();
  await page
    .getByRole("heading", { name: "Páginas web", exact: true })
    .waitFor();
  await page.getByRole("button", { name: "Resumen", exact: true }).click();
  if (await page.getByRole("tab").count())
    throw new Error("Se crearon pestañas de navegación");
  if ((await app.windows()).length !== 1)
    throw new Error("Se creó una ventana adicional");
  await page.evaluate(() => document.documentElement.classList.add("dark"));
  await capture("panel-implemented-dark.png");
  await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0].setSize(360, 800),
  );
  await page.waitForFunction(() => window.innerWidth < 760);
  await page
    .getByRole("button", { name: "Menú compacto por el ancho disponible" })
    .waitFor();
  await capture("panel-implemented-compact.png");
  console.log(
    "Smoke Electron: navegación, una ventana, sin tabs, tema claro/oscuro y menú compacto correctos.",
  );
} finally {
  await app?.close();
  await server.close();
}
