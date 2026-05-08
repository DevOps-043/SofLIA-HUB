import { toolError, toolResponse } from '../types';
import type { FunctionResponse } from '../types';
import { execAsync } from './exec';

const PROCESS_TOOLS = new Set(['list_processes', 'kill_process']);

export async function executeProcessTool(toolName: string, toolArgs: Record<string, any>): Promise<FunctionResponse | null> {
  if (!PROCESS_TOOLS.has(toolName)) return null;

  if (toolName === 'list_processes') {
    try {
      const sortBy = toolArgs.sort_by || 'memory';
      const top = toolArgs.top || 15;
      const sortCol = sortBy === 'cpu' ? 'CPU' : sortBy === 'name' ? 'ProcessName' : 'WorkingSet64';
      const { stdout } = await execAsync(
        `powershell -NoProfile -Command "Get-Process | Sort-Object ${sortCol} -Descending | Select-Object -First ${top} ProcessName, Id, @{N='CPU_s';E={[math]::Round($_.CPU,1)}}, @{N='Mem_MB';E={[math]::Round($_.WorkingSet64/1MB,1)}} | ConvertTo-Json -Compress"`,
        { timeout: 10000, windowsHide: true },
      );
      let processes = JSON.parse(stdout.trim());
      if (!Array.isArray(processes)) processes = [processes];
      return toolResponse(toolName, { success: true, processes, count: processes.length });
    } catch (err: any) {
      return toolError(toolName, err.message);
    }
  }

  try {
    if (toolArgs.pid) {
      await execAsync(`powershell -NoProfile -Command "Stop-Process -Id ${toolArgs.pid} -Force"`, { timeout: 10000, windowsHide: true });
      return toolResponse(toolName, { success: true, message: `Proceso con PID ${toolArgs.pid} cerrado.` });
    }

    if (!toolArgs.name) return toolResponse(toolName, { success: false, error: 'Debes especificar pid o name.' });
    const procName = toolArgs.name.replace(/\.exe$/i, '');
    const { stdout } = await execAsync(
      `powershell -NoProfile -Command "(Get-Process -Name '${procName}' -ErrorAction SilentlyContinue).Count"`,
      { timeout: 10000, windowsHide: true },
    );
    const count = parseInt(stdout.trim()) || 0;
    if (count === 0) return toolResponse(toolName, { success: false, error: `No se encontro ningun proceso con nombre "${procName}".` });
    await execAsync(`powershell -NoProfile -Command "Stop-Process -Name '${procName}' -Force"`, { timeout: 10000, windowsHide: true });
    return toolResponse(toolName, { success: true, message: `${count} instancia(s) de "${procName}" cerrada(s).` });
  } catch (err: any) {
    return toolError(toolName, err.message);
  }
}
