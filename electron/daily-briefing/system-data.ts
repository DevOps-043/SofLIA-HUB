import { execSync } from 'node:child_process';
import os from 'node:os';
import type { DailyBriefingSystemData } from './types';

export function collectDailyBriefingSystemData(): DailyBriefingSystemData {
  const dateStr = new Date().toLocaleDateString('es-MX', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const freeMem = (os.freemem() / (1024 * 1024 * 1024)).toFixed(2);
  const totalMem = (os.totalmem() / (1024 * 1024 * 1024)).toFixed(2);
  const { diskInfo, processesInfo } = collectNativeSystemDetails();

  return {
    dateStr,
    freeMem,
    totalMem,
    diskInfo,
    processesInfo,
    formatted: [
      `Fecha: ${dateStr}`,
      `Memoria RAM: Libre ${freeMem} GB de ${totalMem} GB`,
      'Espacio en Disco:',
      diskInfo,
      '',
      'Top 5 Procesos Activos (CPU):',
      processesInfo,
    ].join('\n'),
  };
}

function collectNativeSystemDetails(): { diskInfo: string; processesInfo: string } {
  try {
    if (os.platform() === 'win32') {
      const diskInfo = execSync('wmic logicaldisk get caption,freespace,size', { encoding: 'utf-8' }).trim();
      const psCommand = 'Get-Process | Sort-Object CPU -Descending | Select-Object -First 5 Name, CPU | Format-Table -HideTableHeaders';
      const processesInfo = execSync(`powershell -NoProfile -Command "${psCommand}"`, { encoding: 'utf-8' }).trim();
      return { diskInfo, processesInfo };
    }

    return {
      diskInfo: execSync('df -h /', { encoding: 'utf-8' }).trim(),
      processesInfo: execSync('ps -eo comm,%cpu,%mem --sort=-%cpu | head -n 6', { encoding: 'utf-8' }).trim(),
    };
  } catch (err: any) {
    console.warn('[DailyBriefing] Error parcial recopilando datos nativos:', err.message);
    return { diskInfo: 'No disponible', processesInfo: 'No disponible' };
  }
}
