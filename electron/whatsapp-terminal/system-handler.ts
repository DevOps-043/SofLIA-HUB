import os from 'node:os';
import { createRequire } from 'node:module';
import { SysCmdSchema } from './schemas';

const moduleRequire = createRequire(import.meta.url);
const si = moduleRequire('systeminformation');

export async function handleSysCommand(args: string[]): Promise<string> {
  const parsed = SysCmdSchema.safeParse(args);
  if (!parsed.success) {
    return `[ERROR] Invalid /sys command.\nUsage: /sys [info|cpu|mem]`;
  }

  const [, subCmd] = parsed.data;
  try {
    if (subCmd === 'info') {
      const osInfo = await si.osInfo();
      const system = await si.system();
      return `[System Info]\nOS: ${osInfo.distro} ${osInfo.release} (${osInfo.platform})\nKernel: ${osInfo.kernel}\nArch: ${osInfo.arch}\nSystem: ${system.manufacturer} ${system.model}\nHostname: ${os.hostname()}`;
    }

    if (subCmd === 'cpu') {
      const cpu = await si.cpu();
      const currentLoad = await si.currentLoad();
      return `[CPU Info]\nModel: ${cpu.manufacturer} ${cpu.brand}\nCores: ${cpu.cores} (${cpu.physicalCores} physical)\nSpeed: ${cpu.speed} GHz\nCurrent Load: ${currentLoad.currentLoad.toFixed(2)}%`;
    }

    if (subCmd === 'mem') {
      const mem = await si.mem();
      const totalGB = (mem.total / 1024 / 1024 / 1024).toFixed(2);
      const usedGB = (mem.active / 1024 / 1024 / 1024).toFixed(2);
      const freeGB = (mem.free / 1024 / 1024 / 1024).toFixed(2);
      return `[Memory Info]\nTotal: ${totalGB} GB\nUsed: ${usedGB} GB\nFree: ${freeGB} GB`;
    }

    return '[ERROR] Unknown /sys sub-command';
  } catch (error: any) {
    return `[SYS ERROR]: ${error.message}`;
  }
}
