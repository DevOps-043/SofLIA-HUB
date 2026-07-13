import { toolError, toolResponse } from '../types';
import type { FunctionResponse } from '../types';
import { execAsync } from './exec';
import { buildVolumeCommand } from './volume';

// Control contextual de entorno (portado de la referencia docs/jarvis-reference):
// ajusta volumen, brillo, plan de energia y notificaciones segun un preset de
// contexto o valores individuales. Solo Windows.

type PowerPlan = 'balanced' | 'high_performance' | 'power_saver';

interface ContextSettings {
  volume?: number;
  brightness?: number;
  power_plan?: PowerPlan;
  dnd?: 'off' | 'on';
}

const POWER_PLAN_GUIDS: Record<PowerPlan, string> = {
  balanced: '381b4222-f694-41f0-9685-ff5bb260df2e',
  high_performance: '8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c',
  power_saver: 'a1841308-3541-4fab-bc81-f71556f20b4a',
};

const CONTEXT_PRESETS: Record<string, Required<ContextSettings>> = {
  reunion: { volume: 40, brightness: 60, power_plan: 'balanced', dnd: 'on' },
  foco: { volume: 20, brightness: 50, power_plan: 'power_saver', dnd: 'on' },
  multimedia: { volume: 80, brightness: 80, power_plan: 'balanced', dnd: 'off' },
  gaming: { volume: 75, brightness: 90, power_plan: 'high_performance', dnd: 'on' },
  normal: { volume: 50, brightness: 70, power_plan: 'balanced', dnd: 'off' },
};

export async function executeContextualControlTool(
  toolName: string,
  toolArgs: Record<string, unknown>,
): Promise<FunctionResponse | null> {
  if (toolName !== 'contextual_control') return null;

  if (process.platform !== 'win32') {
    return toolResponse(toolName, { success: false, error: `Control contextual no soportado en ${process.platform}.` });
  }

  const settings = resolveSettings(toolArgs);
  if (!settings) {
    return toolResponse(toolName, {
      success: false,
      error: 'Debes indicar un mode (reunion, foco, multimedia, gaming, normal) o al menos un ajuste individual (volume, brightness, power_plan, dnd).',
    });
  }

  const applied: string[] = [];
  const warnings: string[] = [];

  try {
    if (settings.volume !== undefined) {
      const level = Math.max(0, Math.min(100, Number(settings.volume)));
      const psCmd = buildVolumeCommand({ level });
      if (psCmd) {
        await runPowerShell(psCmd);
        applied.push(`volumen ${level}%`);
      }
    }

    if (settings.brightness !== undefined) {
      const level = Math.max(0, Math.min(100, Number(settings.brightness)));
      try {
        await runPowerShell(
          `Get-CimInstance -Namespace root/WMI -ClassName WmiMonitorBrightnessMethods | Invoke-CimMethod -MethodName WmiSetBrightness -Arguments @{Timeout=0; Brightness=${level}} | Out-Null`,
        );
        applied.push(`brillo ${level}%`);
      } catch {
        // Comun en PCs de escritorio: los monitores externos no exponen WMI.
        warnings.push('El brillo no pudo ajustarse (el monitor no soporta control por WMI, tipico en equipos de escritorio).');
      }
    }

    if (settings.power_plan !== undefined) {
      const guid = POWER_PLAN_GUIDS[settings.power_plan];
      if (guid) {
        await execAsync(`powercfg /setactive ${guid}`, { timeout: 10000, windowsHide: true });
        applied.push(`plan de energia '${settings.power_plan}'`);
      } else {
        warnings.push(`Plan de energia desconocido: '${settings.power_plan}'. Usa balanced, high_performance o power_saver.`);
      }
    }

    if (settings.dnd !== undefined) {
      // dnd=on desactiva los banners de notificaciones de Windows; dnd=off los restaura.
      const toastsEnabled = settings.dnd === 'on' ? 0 : 1;
      try {
        await runPowerShell(
          `New-ItemProperty -Path 'HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Notifications\\Settings' -Name 'NOC_GLOBAL_SETTING_TOASTS_ENABLED' -Value ${toastsEnabled} -PropertyType DWord -Force | Out-Null`,
        );
        applied.push(settings.dnd === 'on' ? 'notificaciones silenciadas' : 'notificaciones restauradas');
      } catch {
        warnings.push('No se pudo cambiar el estado de las notificaciones.');
      }
    }

    if (applied.length === 0 && warnings.length > 0) {
      return toolResponse(toolName, { success: false, error: warnings.join(' ') });
    }

    const mode = typeof toolArgs.mode === 'string' ? toolArgs.mode.toLowerCase() : null;
    const prefix = mode && CONTEXT_PRESETS[mode] ? `Modo ${mode} aplicado: ` : 'Ajustes aplicados: ';
    return toolResponse(toolName, {
      success: true,
      message: prefix + applied.join(', ') + (warnings.length ? `. Avisos: ${warnings.join(' ')}` : '.'),
    });
  } catch (err) {
    return toolError(toolName, err instanceof Error ? err.message : String(err));
  }
}

function resolveSettings(toolArgs: Record<string, unknown>): ContextSettings | null {
  const mode = typeof toolArgs.mode === 'string' ? toolArgs.mode.toLowerCase().trim() : '';
  const preset = CONTEXT_PRESETS[mode];
  const overrides: ContextSettings = {};
  if (toolArgs.volume !== undefined) overrides.volume = Number(toolArgs.volume);
  if (toolArgs.brightness !== undefined) overrides.brightness = Number(toolArgs.brightness);
  if (typeof toolArgs.power_plan === 'string') overrides.power_plan = toolArgs.power_plan.toLowerCase() as PowerPlan;
  if (typeof toolArgs.dnd === 'string') overrides.dnd = toolArgs.dnd.toLowerCase() === 'on' ? 'on' : 'off';

  if (!preset && Object.keys(overrides).length === 0) return null;
  return { ...(preset ?? {}), ...overrides };
}

function runPowerShell(command: string): Promise<{ stdout: string; stderr: string }> {
  return execAsync(`powershell -NoProfile -Command "${command.replace(/"/g, '\\"')}"`, {
    timeout: 15000,
    windowsHide: true,
  });
}
