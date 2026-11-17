import path from 'node:path';
import process from 'node:process';
import console from 'node:console';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { prepareVoiceEngine } from './prepare-voice-engine.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const targets = { win: ['--win'], mac: ['--mac'], linux: ['--linux', 'AppImage', 'deb', '--x64'] };
export function distributionPlan(platform, target) {
  if (target && !Object.hasOwn(targets, target)) throw new Error('Destino de distribución inválido.');
  const windows = target === 'win' || !target && platform === 'win32';
  if (windows && platform !== 'win32') throw new Error('La distribución firmada de Windows se construye en Windows.');
  return { windows, arguments: [...(targets[target] || []), ...(windows ? ['--config', 'electron-builder.windows.cjs'] : []), '--publish', 'never'] };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.length > 3) throw new Error('Sólo se permite un destino de distribución.');
    const plan = distributionPlan(process.platform, process.argv[2]);
    if (process.env.SOFLIA_UNSIGNED_QA) throw new Error('Una distribución no admite SOFLIA_UNSIGNED_QA.');
    await prepareVoiceEngine(root);
    const npm = process.env.npm_execpath;
    if (!npm || !path.isAbsolute(npm)) throw new Error('Ejecuta la distribución mediante npm run build.');
    const run = args => execFileSync(process.execPath, args, { cwd: root, env: process.env, stdio: 'inherit', windowsHide: true, timeout: 60 * 60_000 });
    run([npm, 'run', 'build:app']);
    run([path.join(root, 'scripts/generate-bitmaps.js')]);
    run([path.join(root, 'node_modules/electron-builder/cli.js'), ...plan.arguments]);
    if (plan.windows) run([path.join(root, 'scripts/build-installer-shell.mjs')]);
  } catch (error) { console.error(`[Distribución] ${error.message}`); process.exitCode = 1; }
}
