import { createRequire } from 'node:module';
import { toolError, toolResponse } from '../types';
import type { FunctionResponse } from '../types';

const requireModule = createRequire(import.meta.url);
const si = requireModule('systeminformation');

const PROCESS_TOOLS = new Set(['list_processes', 'kill_process']);

export async function executeProcessTool(toolName: string, toolArgs: Record<string, any>): Promise<FunctionResponse | null> {
  if (!PROCESS_TOOLS.has(toolName)) return null;

  if (toolName === 'list_processes') {
    try {
      const sortBy = toolArgs.sort_by || 'memory';
      const top = toolArgs.top || 15;
      const data = await si.processes();
      const sortKey = sortBy === 'cpu' ? 'cpu' : sortBy === 'name' ? 'name' : 'memRss';
      const processes = data.list
        .sort((left: any, right: any) => sortBy === 'name'
          ? String(left.name || '').localeCompare(String(right.name || ''))
          : Number(right[sortKey] || 0) - Number(left[sortKey] || 0))
        .slice(0, Math.max(1, Math.min(Number(top) || 15, 50)))
        .map((processInfo: any) => ({
          ProcessName: processInfo.name || 'Unknown',
          Id: processInfo.pid,
          CPU_s: Number((processInfo.cpu || 0).toFixed(1)),
          Mem_MB: Number(((processInfo.memRss || 0) / 1024).toFixed(1)),
        }));
      return toolResponse(toolName, { success: true, processes, count: processes.length });
    } catch (err: any) {
      return toolError(toolName, err.message);
    }
  }

  try {
    if (toolArgs.pid) {
      const pid = Number(toolArgs.pid);
      if (!Number.isFinite(pid) || pid <= 0) return toolResponse(toolName, { success: false, error: 'PID invalido.' });
      process.kill(pid, 'SIGKILL');
      return toolResponse(toolName, { success: true, message: `Proceso con PID ${pid} cerrado.` });
    }

    if (!toolArgs.name) return toolResponse(toolName, { success: false, error: 'Debes especificar pid o name.' });
    const procName = String(toolArgs.name).replace(/\.exe$/i, '').trim().toLowerCase();
    if (!procName || /[\r\n\u0000-\u001f]/.test(procName)) {
      return toolResponse(toolName, { success: false, error: 'Nombre de proceso invalido.' });
    }
    const data = await si.processes();
    const matches = data.list.filter((processInfo: any) =>
      String(processInfo.name || '').replace(/\.exe$/i, '').toLowerCase() === procName);
    if (matches.length === 0) return toolResponse(toolName, { success: false, error: `No se encontro ningun proceso con nombre "${procName}".` });
    for (const match of matches) process.kill(Number(match.pid), 'SIGKILL');
    return toolResponse(toolName, { success: true, message: `${matches.length} instancia(s) de "${procName}" cerrada(s).` });
  } catch (err: any) {
    return toolError(toolName, err.message);
  }
}
