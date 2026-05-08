import { ipcMain } from 'electron';
import type { ProcessState } from './types';

export function registerProcessMonitorIpc(
  processMap: Map<number, ProcessState>,
  killProcess: (pid: number) => boolean,
) {
  ipcMain.handle('proactive:kill-process', async (_event, pid: number) => {
    try {
      return { success: killProcess(pid) };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('proactive:get-tracked-processes', async () => ({
    success: true,
    processes: Array.from(processMap.entries()).map(([pid, state]) => ({ pid, ...state })),
  }));
}
