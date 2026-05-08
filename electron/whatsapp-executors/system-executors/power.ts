import { toolError, toolResponse } from '../types';
import type { FunctionResponse } from '../types';
import { execAsync } from './exec';

const POWER_TOOLS = new Set(['lock_session', 'shutdown_computer', 'restart_computer', 'sleep_computer', 'cancel_shutdown']);

export async function executePowerTool(toolName: string, toolArgs: Record<string, any>): Promise<FunctionResponse | null> {
  if (!POWER_TOOLS.has(toolName)) return null;

  try {
    if (toolName === 'lock_session') {
      await execAsync('rundll32.exe user32.dll,LockWorkStation', { timeout: 5000, windowsHide: true });
      return toolResponse(toolName, { success: true, message: 'Sesion bloqueada.' });
    }
    if (toolName === 'shutdown_computer' || toolName === 'restart_computer') {
      const delay = toolArgs.delay_seconds || 60;
      const mode = toolName === 'shutdown_computer' ? '/s' : '/r';
      await execAsync(`shutdown ${mode} /t ${delay}`, { timeout: 5000, windowsHide: true });
      const label = toolName === 'shutdown_computer' ? 'Apagado' : 'Reinicio';
      return toolResponse(toolName, { success: true, message: `${label} programado en ${delay} segundos. Usa cancel_shutdown para cancelar.` });
    }
    if (toolName === 'sleep_computer') {
      await execAsync('powershell -NoProfile -Command "Add-Type -Assembly System.Windows.Forms; [System.Windows.Forms.Application]::SetSuspendState([System.Windows.Forms.PowerState]::Suspend, $false, $false)"', { timeout: 5000, windowsHide: true });
      return toolResponse(toolName, { success: true, message: 'Computadora en modo suspension.' });
    }

    await execAsync('shutdown /a', { timeout: 5000, windowsHide: true });
    return toolResponse(toolName, { success: true, message: 'Apagado/reinicio cancelado.' });
  } catch (err: any) {
    return toolError(toolName, err.message);
  }
}
