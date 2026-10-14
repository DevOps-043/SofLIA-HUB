import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { detectPlatformCapabilities } from '../../platform-capabilities';
import type { ExistingWindowMatch } from './types';

const execFileAsync = promisify(execFile);

export async function focusLinuxApplicationWindow(requested: string, resolved: string): Promise<ExistingWindowMatch | null> {
  if (!detectPlatformCapabilities().linuxXdotool) return null;
  const token = path.basename(resolved).replace(/\.desktop$/, '').split('_')[0].toLowerCase();
  const names = new Set([token, requested.trim().toLowerCase()]);
  try {
    const deadline = Date.now() + 4000;
    const run = async (args: string[]) => {
      const remaining = deadline - Date.now();
      if (remaining <= 0) throw new Error('Se agotó el tiempo para comprobar la ventana.');
      return (await execFileAsync('xdotool', args, { timeout: remaining })).stdout.trim();
    };
    const ids = (await run(['search', '--onlyvisible', '--name', '.'])).split(/\s+/).slice(0, 100);
    for (const id of ids) {
      if (Date.now() >= deadline) break;
      if (!/^\d+$/.test(id)) continue;
      try {
        const pid = Number(await run(['getwindowpid', id]));
        if (!Number.isSafeInteger(pid) || pid <= 0) continue;
        const processName = (await fs.readFile(`/proc/${pid}/comm`, 'utf8')).trim();
        const binary = path.basename(await fs.readlink(`/proc/${pid}/exe`)).toLowerCase();
        // Un título del chat con «Firefox» no demuestra que sea una ventana de Firefox.
        if (!names.has(binary) && !names.has(processName.toLowerCase())) continue;
        const title = await run(['getwindowname', id]);
        await run(['windowactivate', '--sync', id]);
        if (await run(['getactivewindow']) !== id) continue;
        return { pid, process: processName, title };
      } catch { /* La ventana pudo cerrarse durante la comprobación. */ }
    }
  } catch { /* X11 sin xdotool no proporciona evidencia de una ventana. */ }
  return null;
}
