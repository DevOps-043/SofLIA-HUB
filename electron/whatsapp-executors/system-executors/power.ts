import { toolError, toolResponse } from '../types';
import type { FunctionResponse } from '../types';
import { execAsync } from './exec';

const POWER_TOOLS = new Set(['lock_session', 'shutdown_computer', 'restart_computer', 'sleep_computer', 'cancel_shutdown']);

export async function executePowerTool(toolName: string, toolArgs: Record<string, any>): Promise<FunctionResponse | null> {
  if (!POWER_TOOLS.has(toolName)) return null;

  try {
    if (process.platform === 'linux') return executeLinuxPowerTool(toolName, toolArgs);
    if (process.platform !== 'win32') {
      return toolResponse(toolName, { success: false, error: `Herramienta no soportada en ${process.platform}.` });
    }

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

async function executeLinuxPowerTool(toolName: string, toolArgs: Record<string, any>): Promise<FunctionResponse> {
  if (toolName === 'lock_session') {
    await execAsync('loginctl lock-session || xdg-screensaver lock', { timeout: 5000 });
    return toolResponse(toolName, { success: true, message: 'Sesion bloqueada.' });
  }

  if (toolName === 'shutdown_computer' || toolName === 'restart_computer') {
    const delay = Math.max(0, Number(toolArgs.delay_seconds || 60));
    const minutes = Math.max(1, Math.ceil(delay / 60));
    const mode = toolName === 'shutdown_computer' ? '-h' : '-r';
    await execAsync(`shutdown ${mode} +${minutes}`, { timeout: 5000 });
    const label = toolName === 'shutdown_computer' ? 'Apagado' : 'Reinicio';
    return toolResponse(toolName, { success: true, message: `${label} programado en ${minutes} minuto(s). Usa cancel_shutdown para cancelar.` });
  }

  if (toolName === 'sleep_computer') {
    await execAsync('systemctl suspend', { timeout: 5000 });
    return toolResponse(toolName, { success: true, message: 'Computadora en modo suspension.' });
  }

  await execAsync('shutdown -c', { timeout: 5000 });
  return toolResponse(toolName, { success: true, message: 'Apagado/reinicio cancelado.' });
}
