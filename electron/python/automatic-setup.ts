import { execFile } from 'node:child_process';
import path from 'node:path';
import { app } from 'electron';
import { ensureSignedVoiceEngine } from './signed-engine';

/** Ejecuta únicamente el preparador distribuido; nunca un comando del renderer. */
export async function preparePrivatePython(): Promise<void> {
  if (app.isPackaged && process.platform === 'win32') { await ensureSignedVoiceEngine(); return; }
  const root = app.isPackaged ? path.join(process.resourcesPath, 'python-setup') : app.getAppPath();
  const destination = app.isPackaged ? path.join(app.getPath('userData'), 'python-runtime') : path.join(root, 'python-runtime');
  // El hijo no hereda las variables de Vite exigidas al proceso principal.
  const env = {} as NodeJS.ProcessEnv;
  for (const key of ['SystemRoot', 'WINDIR', 'ComSpec', 'PATH', 'PATHEXT', 'TEMP', 'TMP', 'HOME', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA']) {
    if (process.env[key]) env[key] = process.env[key];
  }
  env.ELECTRON_RUN_AS_NODE = '1';
  env.SOFLIA_PYTHON_RUNTIME_DIRECTORY = destination;
  await new Promise<void>((resolve, reject) => {
    execFile(process.execPath, [path.join(root, 'scripts', 'setup-python-runtime.js')], {
      cwd: root, env, encoding: 'utf8', windowsHide: true, timeout: 35 * 60_000, maxBuffer: 2 * 1024 * 1024,
    }, (error, _stdout, stderr) => {
      if (!error) { resolve(); return; }
      // No devolver stderr libre: puede contener rutas del equipo o detalles de pip.
      const blocked = /(?:Control de aplicaciones|Application Control|App Control|WinError 4551)/iu.test(stderr);
      reject(new Error(blocked ? 'voice_runtime_blocked' : 'voice_setup_failed'));
    });
  });
}
