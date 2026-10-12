import { app, BrowserWindow } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { SkillWorkspaceService } from '../../electron/skill-workspace/service';
import { registerSkillWorkspaceHandlers } from '../../electron/skill-workspace-handlers';
import { AUDIOVISUAL_SKILL } from '../../src/shared/skills/audiovisual-skill';
import { SOFLIA_DEFAULT_MODEL, SOFLIA_MAX_MODEL } from '../../src/shared/soflia-runtime-model';

let stage = 'entrada en memoria';
async function main() {
  const root = path.resolve(process.env.SOFLIA_EVAL_SOURCE ?? process.cwd()), output = path.resolve(process.argv[2]);
  const models = process.env.SOFLIA_EVAL_MODEL ? [process.env.SOFLIA_EVAL_MODEL] : [SOFLIA_DEFAULT_MODEL, SOFLIA_MAX_MODEL];
  if (models.some(model => model !== SOFLIA_DEFAULT_MODEL && model !== SOFLIA_MAX_MODEL)) throw new Error('Modelo fuera de la evaluación.');
  let window: BrowserWindow | null = null;
  const endpoint = process.env.SOFLIA_EVAL_CLIENT ?? '';
  if (!/^http:\/\/127\.0\.0\.1:\d+\/[a-f0-9-]{36}$/.test(endpoint)) throw new Error('Canal local inválido.');
  const data = await (await fetch(endpoint, { signal: AbortSignal.timeout(30_000) })).json();
  if (typeof data.client !== 'string' || Buffer.byteLength(data.client) > 4_000_000) throw new Error('Cliente inválido.');
  const client: string = data.client;
  stage = 'perfil y runtime';
  await fs.mkdir(path.join(output, 'perfil-aislado'), { recursive: true });
  app.setPath('userData', path.join(output, 'perfil-aislado'));
  process.env.APP_ROOT = root;
  app.on('window-all-closed', () => undefined);
  await app.whenReady();
  const workspace = new SkillWorkspaceService(path.join(output, 'workspaces'));
  registerSkillWorkspaceHandlers(workspace, () => window);
  const reports: Array<{ ok: boolean }> = [];
  let exitCode = 1;
  try {
    stage = 'brief y hashes del runtime';
    const brief = await fs.readFile(path.join(root, 'test/evaluation/audiovisual-brief.md'), 'utf8');
    const runtimeHashes = Object.fromEntries(await Promise.all(['film-runtime.iife.js', 'film-runtime.css'].map(async file => [file, createHash('sha256').update(await fs.readFile(path.join(root, 'dist/audiovisual', file))).digest('hex')])));
    for (const model of models) {

      stage = 'creación del workspace';
      const created = await workspace.createWorkspace({ skillId: AUDIOVISUAL_SKILL.id, title: 'Evaluación autónoma ' + model, policy: AUDIOVISUAL_SKILL.workspace! });
      if (!created.ok) throw new Error(created.error);
      const payload = JSON.stringify({ workspaceId: created.data.id, model, brief }).replace(/</g, '\\u003c');
      const file = path.join(output, 'evaluacion.html');
      await fs.writeFile(file, `<!doctype html><html lang="es"><head><meta charset="utf-8"></head><body><script>window.__AUDIO_EVAL__=${payload}</script></body></html>`);
      window = new BrowserWindow({ show: false, webPreferences: { preload: path.join(root, 'dist-electron/preload.js'), sandbox: true, contextIsolation: true, nodeIntegration: false, backgroundThrottling: false } });
      stage = 'carga de la ventana';
      await window.loadFile(file);
      stage = 'cliente en memoria';
      await window.webContents.executeJavaScript(client + ';void 0;');
      stage = 'generación autónoma';
      const report = await window.webContents.executeJavaScript('window.__audioEval()');
      reports.push({ ...report, workspaceId: created.data.id, runtimeRoot: root, runtimeHashes });
      await fs.writeFile(path.join(output, 'evaluacion-autonoma.json'), JSON.stringify(reports, null, 2));
      console.info(JSON.stringify({ model, ok: report.ok, herramientas: report.trace.length, segundos: report.elapsedMs / 1000 }));
      window.destroy(); window = null;
    }
    exitCode = reports.length === models.length && reports.every(report => report.ok) ? 0 : 1;
  } finally { window?.destroy(); app.exit(exitCode); }
}
void main().catch(() => { console.error('No se pudo iniciar la evaluación autónoma: ' + stage + '.'); app.exit(1); });
