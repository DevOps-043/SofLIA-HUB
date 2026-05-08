import { createRequire } from 'node:module';

const _require = createRequire(import.meta.url);
const si = _require('systeminformation');

const SYSTEM_PROCESSES = [
  'svchost.exe', 'conhost.exe', 'explorer.exe', 'System', 'Registry',
  'smss.exe', 'csrss.exe', 'wininit.exe', 'services.exe', 'lsass.exe',
  'winlogon.exe', 'fontdrvhost.exe', 'dwm.exe', 'spoolsv.exe', 'Taskmgr.exe',
  'SearchUI.exe', 'sihost.exe', 'taskhostw.exe', 'RuntimeBroker.exe',
  'kernel_task', 'launchd', 'sysmond', 'WindowServer', 'systemd',
];

export async function getRunningApps(): Promise<any> {
  try {
    const data = await si.processes();
    const uniqueApps = new Map<string, any>();

    for (const processInfo of data.list) {
      const name = processInfo.name || '';
      if (!name || isSystemProcess(name)) continue;

      const key = name.toLowerCase();
      if (!uniqueApps.has(key)) {
        uniqueApps.set(key, {
          name,
          pid: processInfo.pid,
          cpu: Number((processInfo.cpu || 0).toFixed(2)),
          memory: Number((processInfo.mem || 0).toFixed(2)),
        });
      }
    }

    const apps = Array.from(uniqueApps.values())
      .sort((left, right) => right.memory - left.memory)
      .slice(0, 50);

    return {
      success: true,
      apps,
      total: apps.length,
      message: `Se encontraron ${apps.length} aplicaciones principales en ejecucion.`,
    };
  } catch (error: any) {
    return { success: false, error: `Error obteniendo procesos: ${error.message}` };
  }
}

function isSystemProcess(name: string): boolean {
  return SYSTEM_PROCESSES.some((systemName) => name.toLowerCase() === systemName.toLowerCase());
}
