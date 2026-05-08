import fsSync from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { formatBytes } from '../utils/file-utils';

const requireCjs = createRequire(import.meta.url);
const si = requireCjs('systeminformation');

export async function handleListProcesses(): Promise<{ success: boolean; processes?: Array<{ pid: number; name: string; cpu: number; mem: number; command: string }>; count?: number; error?: string }> {
  try {
    console.log('[ComputerUse] Listing system processes...');
    const data = await si.processes();
    const processes = data.list
      .sort((a: any, b: any) => (b.cpu || 0) - (a.cpu || 0))
      .slice(0, 20)
      .map((p: any) => ({
        pid: p.pid,
        name: p.name || 'Unknown',
        cpu: Number((p.cpu || 0).toFixed(2)),
        mem: Number((p.mem || 0).toFixed(2)),
        command: p.command || '',
      }));
    return { success: true, processes, count: processes.length };
  } catch (err: any) {
    console.error('[ComputerUse] Error listing processes:', err);
    return { success: false, error: err.message };
  }
}

export async function handleKillProcess(pid: number): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    if (Number.isNaN(pid) || typeof pid !== 'number' || pid <= 0) {
      return { success: false, error: 'PID invalido o no proporcionado (debe ser un numero positivo).' };
    }
    process.kill(pid, 'SIGKILL');
    return { success: true, message: `Proceso ${pid} terminado exitosamente` };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function handleGetSystemInfo(): Promise<Record<string, any>> {
  try {
    const cpus = os.cpus();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const home = os.homedir();
    const possibleDesktops = [
      path.join(home, 'OneDrive', 'Escritorio'),
      path.join(home, 'OneDrive', 'Desktop'),
      path.join(home, 'Desktop'),
      path.join(home, 'Escritorio'),
    ];
    let desktopPath = path.join(home, 'Desktop');
    for (const candidate of possibleDesktops) {
      try {
        fsSync.accessSync(candidate);
        desktopPath = candidate;
        break;
      } catch {
        // try next desktop location
      }
    }
    return {
      success: true,
      platform: os.platform(),
      release: os.release(),
      arch: os.arch(),
      hostname: os.hostname(),
      username: os.userInfo().username,
      homeDir: home,
      tempDir: os.tmpdir(),
      desktopPath,
      documentsPath: path.join(home, 'Documents'),
      downloadsPath: path.join(home, 'Downloads'),
      cpu: { model: cpus[0]?.model || 'Unknown', cores: cpus.length },
      memory: { total: formatBytes(totalMem), free: formatBytes(freeMem), used: formatBytes(totalMem - freeMem), usagePercent: Math.round(((totalMem - freeMem) / totalMem) * 100) },
      uptime: `${Math.floor(os.uptime() / 3600)}h ${Math.floor((os.uptime() % 3600) / 60)}m`,
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
