import { toolError, toolResponse } from '../types';
import type { FunctionResponse } from '../types';
import { execAsync } from './exec';

export async function executeVolumeTool(toolName: string, toolArgs: Record<string, any>): Promise<FunctionResponse | null> {
  if (toolName !== 'set_volume') return null;

  try {
    if (process.platform === 'linux') {
      await executeLinuxVolumeCommand(toolArgs);
      return toolResponse(toolName, { success: true, message: describeVolumeAction(toolArgs) });
    }
    if (process.platform !== 'win32') {
      return toolResponse(toolName, { success: false, error: `Control de volumen no soportado en ${process.platform}.` });
    }

    const psCmd = buildVolumeCommand(toolArgs);
    if (!psCmd) {
      return toolResponse(toolName, { success: false, error: 'Debes especificar level (0-100) o action (mute/unmute/up/down).' });
    }

    await execAsync(`powershell -NoProfile -Command "${psCmd.replace(/"/g, '\\"')}"`, { timeout: 10000, windowsHide: true });
    return toolResponse(toolName, { success: true, message: describeVolumeAction(toolArgs) });
  } catch (err: any) {
    return toolError(toolName, err.message);
  }
}

async function executeLinuxVolumeCommand(toolArgs: Record<string, any>): Promise<void> {
  const commands = buildLinuxVolumeCommands(toolArgs);
  if (!commands) throw new Error('Debes especificar level (0-100) o action (mute/unmute/up/down).');

  const [primary, fallback] = commands;
  try {
    await execAsync(primary, { timeout: 10000 });
  } catch (primaryError: any) {
    try {
      await execAsync(fallback, { timeout: 10000 });
    } catch (fallbackError: any) {
      throw new Error(`No se pudo controlar volumen. Instala pactl/pulseaudio-utils o amixer/alsa-utils. Detalle: ${fallbackError.message || primaryError.message}`);
    }
  }
}

function buildLinuxVolumeCommands(toolArgs: Record<string, any>): [string, string] | null {
  if (toolArgs.action === 'mute' || toolArgs.action === 'unmute') {
    const mute = toolArgs.action === 'mute' ? '1' : '0';
    const amixer = toolArgs.action === 'mute' ? 'mute' : 'unmute';
    return [`pactl set-sink-mute @DEFAULT_SINK@ ${mute}`, `amixer -D pulse sset Master ${amixer}`];
  }
  if (toolArgs.action === 'up') return ['pactl set-sink-volume @DEFAULT_SINK@ +5%', 'amixer -D pulse sset Master 5%+'];
  if (toolArgs.action === 'down') return ['pactl set-sink-volume @DEFAULT_SINK@ -5%', 'amixer -D pulse sset Master 5%-'];
  if (toolArgs.level === undefined) return null;

  const level = Math.max(0, Math.min(100, Number(toolArgs.level) || 0));
  return [`pactl set-sink-volume @DEFAULT_SINK@ ${level}%`, `amixer -D pulse sset Master ${level}%`];
}

// Exportado para reuso desde contextual-control (mismo snippet COM CoreAudio).
export function buildVolumeCommand(toolArgs: Record<string, any>): string | null {
  if (toolArgs.action === 'mute' || toolArgs.action === 'unmute') {
    return `$wsh = New-Object -ComObject WScript.Shell; $wsh.SendKeys([char]173)`;
  }
  if (toolArgs.action === 'up') {
    return `$wsh = New-Object -ComObject WScript.Shell; 1..5 | ForEach-Object { $wsh.SendKeys([char]175) }`;
  }
  if (toolArgs.action === 'down') {
    return `$wsh = New-Object -ComObject WScript.Shell; 1..5 | ForEach-Object { $wsh.SendKeys([char]174) }`;
  }
  if (toolArgs.level === undefined) return null;
  const level = Math.max(0, Math.min(100, toolArgs.level));
  return `
Add-Type -TypeDefinition @'
using System.Runtime.InteropServices;
[Guid("5CDF2C82-841E-4546-9722-0CF74078229A"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IAudioEndpointVolume {
    int _0(); int _1(); int _2(); int _3(); int _4(); int _5(); int _6(); int _7();
    int SetMasterVolumeLevelScalar(float fLevel, System.Guid pguidEventContext);
    int _9(); int GetMasterVolumeLevelScalar(out float pfLevel); int _11(); int _12();
}
[Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IMMDevice { int Activate(ref System.Guid iid, int dwClsCtx, System.IntPtr pActivationParams, [MarshalAs(UnmanagedType.IUnknown)] out object ppInterface); }
[Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IMMDeviceEnumerator { int GetDefaultAudioEndpoint(int dataFlow, int role, out IMMDevice ppDevice); }
[ComImport, Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")] class MMDeviceEnumerator {}
'@
$de = New-Object MMDeviceEnumerator
$dev = $null
$de.GetDefaultAudioEndpoint(0, 1, [ref]$dev)
$iid = [Guid]"5CDF2C82-841E-4546-9722-0CF74078229A"
$epv = $null
$dev.Activate([ref]$iid, 1, [System.IntPtr]::Zero, [ref]$epv)
$vol = [IAudioEndpointVolume]$epv
$vol.SetMasterVolumeLevelScalar(${level / 100.0}, [Guid]::Empty)`;
}

function describeVolumeAction(toolArgs: Record<string, any>): string {
  if (!toolArgs.action) return `Volumen ajustado a ${toolArgs.level}%`;
  if (toolArgs.action === 'mute') return 'Silenciado';
  if (toolArgs.action === 'unmute') return 'Desilenciado';
  return toolArgs.action === 'up' ? 'Volumen subido' : 'Volumen bajado';
}
