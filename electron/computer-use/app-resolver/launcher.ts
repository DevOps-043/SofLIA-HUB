import { shell } from 'electron';
import path from 'node:path';
import { backgroundProcessService, type ManagedSessionView } from '../../background-process-service';
import { normalizePath } from '../../utils/file-utils';
import fs from 'node:fs/promises';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export async function launchPathNonBlocking(
  resolvedPath: string,
  metadata?: Record<string, any>,
): Promise<{ success: boolean; error?: string; session?: ManagedSessionView | null }> {
  const normalized = normalizePath(resolvedPath);

  if (process.platform === 'win32') {
    try {
      const session = await backgroundProcessService.launchApplication({
        targetPath: normalized,
        title: `Aplicacion: ${path.basename(normalized)}`,
        metadata,
      });
      if (session.status === 'failed') {
        return { success: false, error: session.lastError || 'No se pudo iniciar el proceso.', session };
      }
      return { success: true, session };
    } catch (err: any) {
      return {
        success: false,
        error: err?.stderr?.trim() || err?.stdout?.trim() || err?.message || 'No se pudo iniciar el proceso.',
      };
    }
  }

  try {
    if (process.platform === 'linux') {
      const info = await fs.stat(normalized);
      if (info.isFile() && path.extname(normalized) === '.desktop') {
        await execFileAsync('gio', ['launch', normalized], { timeout: 10000 });
        return { success: true };
      }
      const executable = info.isFile() && await fs.access(normalized, fs.constants.X_OK).then(() => true, () => false);
      if (executable) return launchLinuxExecutable(normalized);
    }
    const result = await shell.openPath(normalized);
    if (result) {
      return { success: false, error: result };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'No se pudo abrir el elemento.' };
  }
}

function launchLinuxExecutable(target: string): Promise<{ success: boolean; error?: string }> {
  return new Promise(resolve => {
    const child = spawn(target, [], { detached: true, stdio: 'ignore', shell: false });
    let settled = false;
    const finish = (result: { success: boolean; error?: string }) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      child.unref();
      resolve(result);
    };
    // Los launchers (Snap o instancia existente) pueden salir con cero de inmediato.
    const timer = setTimeout(() => finish({ success: true }), 750);
    child.once('error', error => finish({ success: false, error: error.message }));
    child.once('exit', (code, signal) => finish(code === 0
      ? { success: true }
      : { success: false, error: `El proceso terminó antes de abrir una ventana (código ${code}, señal ${signal || 'ninguna'}).` }));
  });
}
