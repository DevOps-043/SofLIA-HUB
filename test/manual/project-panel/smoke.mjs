import { tmpdir } from 'node:os';
import { createServer } from "vite";
import react from "@vitejs/plugin-react";
import { createRequire } from "node:module";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
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
  cacheDir: await mkdtemp(resolve(tmpdir(), "soflia-project-panel-vite-")),
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
  page.setDefaultTimeout(45000);
  page.on("pageerror",error=>console.error("Error de fixture:",error.message));
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
  await page.getByRole('button',{name:'Tareas',exact:true}).click();
  await page.getByRole('button',{name:'Nueva tarea',exact:true}).click();
  await page.getByLabel('Título de la tarea',{exact:true}).fill('Tarea QA nativa');
  await page.getByLabel('Descripción',{exact:true}).fill('Validación aislada del formulario completo.');
  await page.getByLabel('Fecha límite',{exact:true}).fill('2026-12-01');
  await page.getByRole('button',{name:'Guardar tarea',exact:true}).click();
  await page.getByLabel('Título de la tarea',{exact:true}).waitFor({state:'detached'});
  await page.getByRole('button',{name:/Tarea QA nativa/}).waitFor();
  await page.getByRole('button',{name:/Tarea QA nativa/}).click();
  await page.getByLabel('Nuevo comentario',{exact:true}).fill('Comentario QA de la tarea.');
  await page.getByRole('button',{name:'Publicar comentario',exact:true}).click();
  await page.getByRole('article').getByText('Comentario QA de la tarea.',{exact:true}).waitFor();
  await page.getByLabel('Título de la tarea',{exact:true}).fill('Tarea QA editada');
  await page.getByRole('button',{name:'Guardar tarea',exact:true}).click();
  await page.getByLabel('Título de la tarea',{exact:true}).waitFor({state:'detached'});
  await page.getByRole('button',{name:/Tarea QA editada/}).waitFor();
  await page.getByRole('heading',{name:'Tareas',exact:true}).scrollIntoViewIfNeeded();
  await capture('project-management-tasks.png');
  await page.getByRole('button',{name:'Hitos',exact:true}).click();
  await page.getByRole('button',{name:'Nuevo hito',exact:true}).click();
  await page.getByLabel('Nombre del hito',{exact:true}).fill('Entrega QA nativa');
  await page.getByLabel('Fecha objetivo',{exact:true}).fill('2026-12-01');
  await page.getByRole('button',{name:'Guardar hito',exact:true}).click();
  await page.getByRole('heading',{name:'Entrega QA nativa',exact:true}).waitFor();
  await capture('project-management-milestones.png');
  await page.getByRole('button',{name:'Archivos',exact:true}).click();
  await page.getByRole('button',{name:'Vincular documento',exact:true}).click();
  await page.getByLabel('Nombre del documento',{exact:true}).fill('Documento QA nativo');
  await page.getByLabel('Enlace del documento',{exact:true}).fill('https://drive.example.test/guia');
  await page.getByRole('button',{name:'Guardar documento',exact:true}).click();
  await page.getByRole('heading',{name:'Documento QA nativo',exact:true}).waitFor();
  await page.getByRole('button',{name:'Desvincular documento',exact:true}).click();
  await page.getByRole('button',{name:'Confirmar desvinculación',exact:true}).click();
  await page.getByRole('heading',{name:'Documento QA nativo',exact:true}).waitFor({state:'detached'});
  await page.getByRole('button',{name:'Equipos',exact:true}).click();
  await page.getByRole('combobox',{name:'Nuevo integrante',exact:true}).click();
  await page.getByRole('option',{name:'Diego Martínez',exact:true}).click();
  await page.getByRole('button',{name:'Añadir al equipo',exact:true}).click();
  await page.getByRole('button',{name:'Retirar del equipo',exact:true}).waitFor();
  await page.getByRole('heading',{name:'Integrantes del equipo',exact:true}).scrollIntoViewIfNeeded();
  await capture('project-management-team.png');
  await page.getByRole('button',{name:'Retirar del equipo',exact:true}).click();
  await page.getByRole('button',{name:'Confirmar retiro del equipo',exact:true}).click();
  await page.getByText('Diego Martínez',{exact:true}).waitFor({state:'detached'});
  await page.getByRole('button',{name:'Resumen',exact:true}).click();
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
    "Smoke Electron: crear/editar tarea, comentar, crear hito, vincular/desvincular documento, añadir/retirar integrante, navegación, una ventana, sin tabs y temas/menú compacto correctos. Datos ficticios, sin servidor de producción.",
  );
} finally {
  await app?.close();
  await server.close();
}
