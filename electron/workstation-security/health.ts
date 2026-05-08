import { createRequire } from 'node:module';
import os from 'node:os';

const requireModule = createRequire(import.meta.url);
const si = requireModule('systeminformation') as typeof import('systeminformation');

export async function getWorkstationHealth(): Promise<Record<string, any>> {
  try {
    const [cpu, mem, fsSize] = await Promise.all([si.cpu(), si.mem(), si.fsSize()]);
    const mainDisk = fsSize.find((disk: any) => disk.mount === '/' || disk.mount === 'C:') || fsSize[0];

    return {
      cpu: {
        modelo: `${cpu.manufacturer} ${cpu.brand}`,
        nucleos: cpu.cores,
        velocidad: `${cpu.speed} GHz`,
      },
      memoria: {
        total: `${toGB(mem.total)} GB`,
        enUso: `${toGB(mem.active)} GB`,
        porcentaje: `${((mem.active / mem.total) * 100).toFixed(1)}%`,
      },
      discoPrincipal: formatDisk(mainDisk),
      plataforma: `${os.platform()} ${os.release()}`,
      tiempoActivo: `${(os.uptime() / 3600).toFixed(1)} horas`,
      timestamp: new Date().toISOString(),
    };
  } catch (err: any) {
    throw new Error(`Error obteniendo metricas de salud: ${err.message}`);
  }
}

function toGB(bytes: number): string {
  return (bytes / (1024 ** 3)).toFixed(2);
}

function formatDisk(disk: any): string {
  if (!disk) return 'Desconocido';
  return `${toGB(disk.used)} GB / ${toGB(disk.size)} GB (${disk.use}%)`;
}
