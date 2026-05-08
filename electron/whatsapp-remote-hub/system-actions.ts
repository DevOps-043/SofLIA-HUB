import { execSync } from 'child_process';
import { createRequire } from 'node:module';
import os from 'os';

const _require = createRequire(import.meta.url);
const si = _require('systeminformation');

export function lockComputer(): void {
  const platform = os.platform();
  if (platform === 'win32') {
    execSync('rundll32.exe user32.dll,LockWorkStation');
    return;
  }

  if (platform === 'darwin') {
    execSync('pmset displaysleepnow');
    return;
  }

  execSync('loginctl lock-session || xdg-screensaver lock');
}

export async function getSystemStatus(): Promise<string> {
  try {
    const [cpu, mem, temp] = await Promise.all([
      si.currentLoad(),
      si.mem(),
      si.cpuTemperature(),
    ]);

    const cpuLoad = cpu.currentLoad.toFixed(2);
    const memFreeGB = (mem.free / (1024 * 1024 * 1024)).toFixed(2);
    const memTotalGB = (mem.total / (1024 * 1024 * 1024)).toFixed(2);
    const temperature = temp.main && temp.main > 0 ? `${temp.main} C` : 'N/A';

    return `*Estado del Sistema*\n\n` +
      `*CPU:* ${cpuLoad}%\n` +
      `*Memoria Libre:* ${memFreeGB} GB / ${memTotalGB} GB\n` +
      `*Temperatura:* ${temperature}`;
  } catch (error: any) {
    console.error('[WhatsAppRemoteHub] Error al obtener estado:', error);
    return `Error al obtener el estado del sistema: ${error.message}`;
  }
}
