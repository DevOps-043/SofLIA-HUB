/**
 * System control tool executors — processes, power, volume, wifi, terminal.
 */
import os from 'node:os';
import { exec as execCb, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import type { FunctionResponse } from './types';
import { toolResponse, toolError } from './types';

const execAsync = promisify(execCb);

const SYSTEM_TOOLS = new Set([
  'list_processes', 'kill_process', 'lock_session',
  'shutdown_computer', 'restart_computer', 'sleep_computer', 'cancel_shutdown',
  'set_volume', 'toggle_wifi', 'run_in_terminal', 'run_claude_code',
]);

export function isSystemTool(name: string): boolean {
  return SYSTEM_TOOLS.has(name);
}

export async function executeSystemTool(
  toolName: string,
  toolArgs: Record<string, any>,
): Promise<FunctionResponse | null> {
  if (!SYSTEM_TOOLS.has(toolName)) return null;

  if (toolName === 'list_processes') {
    try {
      const sortBy = toolArgs.sort_by || 'memory';
      const top = toolArgs.top || 15;
      const sortCol = sortBy === 'cpu' ? 'CPU' : sortBy === 'name' ? 'ProcessName' : 'WorkingSet64';
      const { stdout } = await execAsync(
        `powershell -NoProfile -Command "Get-Process | Sort-Object ${sortCol} -Descending | Select-Object -First ${top} ProcessName, Id, @{N='CPU_s';E={[math]::Round($_.CPU,1)}}, @{N='Mem_MB';E={[math]::Round($_.WorkingSet64/1MB,1)}} | ConvertTo-Json -Compress"`,
        { timeout: 10000, windowsHide: true }
      );
      let processes = JSON.parse(stdout.trim());
      if (!Array.isArray(processes)) processes = [processes];
      return toolResponse(toolName, { success: true, processes, count: processes.length });
    } catch (err: any) {
      return toolError(toolName, err.message);
    }
  }

  if (toolName === 'kill_process') {
    try {
      if (toolArgs.pid) {
        await execAsync(`powershell -NoProfile -Command "Stop-Process -Id ${toolArgs.pid} -Force"`, { timeout: 10000, windowsHide: true });
        return toolResponse(toolName, { success: true, message: `Proceso con PID ${toolArgs.pid} cerrado.` });
      } else if (toolArgs.name) {
        const procName = toolArgs.name.replace(/\.exe$/i, '');
        const { stdout } = await execAsync(
          `powershell -NoProfile -Command "(Get-Process -Name '${procName}' -ErrorAction SilentlyContinue).Count"`,
          { timeout: 10000, windowsHide: true }
        );
        const count = parseInt(stdout.trim()) || 0;
        if (count === 0) return toolResponse(toolName, { success: false, error: `No se encontró ningún proceso con nombre "${procName}".` });
        await execAsync(`powershell -NoProfile -Command "Stop-Process -Name '${procName}' -Force"`, { timeout: 10000, windowsHide: true });
        return toolResponse(toolName, { success: true, message: `${count} instancia(s) de "${procName}" cerrada(s).` });
      }
      return toolResponse(toolName, { success: false, error: 'Debes especificar pid o name.' });
    } catch (err: any) {
      return toolError(toolName, err.message);
    }
  }

  if (toolName === 'lock_session') {
    try {
      await execAsync('rundll32.exe user32.dll,LockWorkStation', { timeout: 5000, windowsHide: true });
      return toolResponse(toolName, { success: true, message: 'Sesión bloqueada.' });
    } catch (err: any) { return toolError(toolName, err.message); }
  }

  if (toolName === 'shutdown_computer') {
    try {
      const delay = toolArgs.delay_seconds || 60;
      await execAsync(`shutdown /s /t ${delay}`, { timeout: 5000, windowsHide: true });
      return toolResponse(toolName, { success: true, message: `Apagado programado en ${delay} segundos. Usa cancel_shutdown para cancelar.` });
    } catch (err: any) { return toolError(toolName, err.message); }
  }

  if (toolName === 'restart_computer') {
    try {
      const delay = toolArgs.delay_seconds || 60;
      await execAsync(`shutdown /r /t ${delay}`, { timeout: 5000, windowsHide: true });
      return toolResponse(toolName, { success: true, message: `Reinicio programado en ${delay} segundos. Usa cancel_shutdown para cancelar.` });
    } catch (err: any) { return toolError(toolName, err.message); }
  }

  if (toolName === 'sleep_computer') {
    try {
      await execAsync('powershell -NoProfile -Command "Add-Type -Assembly System.Windows.Forms; [System.Windows.Forms.Application]::SetSuspendState([System.Windows.Forms.PowerState]::Suspend, $false, $false)"', { timeout: 5000, windowsHide: true });
      return toolResponse(toolName, { success: true, message: 'Computadora en modo suspensión.' });
    } catch (err: any) { return toolError(toolName, err.message); }
  }

  if (toolName === 'cancel_shutdown') {
    try {
      await execAsync('shutdown /a', { timeout: 5000, windowsHide: true });
      return toolResponse(toolName, { success: true, message: 'Apagado/reinicio cancelado.' });
    } catch (err: any) { return toolError(toolName, err.message); }
  }

  if (toolName === 'set_volume') {
    try {
      let psCmd = '';
      if (toolArgs.action === 'mute' || toolArgs.action === 'unmute') {
        psCmd = `$wsh = New-Object -ComObject WScript.Shell; $wsh.SendKeys([char]173)`;
      } else if (toolArgs.action === 'up') {
        psCmd = `$wsh = New-Object -ComObject WScript.Shell; 1..5 | ForEach-Object { $wsh.SendKeys([char]175) }`;
      } else if (toolArgs.action === 'down') {
        psCmd = `$wsh = New-Object -ComObject WScript.Shell; 1..5 | ForEach-Object { $wsh.SendKeys([char]174) }`;
      } else if (toolArgs.level !== undefined) {
        const level = Math.max(0, Math.min(100, toolArgs.level));
        psCmd = `
Add-Type -TypeDefinition @'
using System.Runtime.InteropServices;
[Guid("5CDF2C82-841E-4546-9722-0CF74078229A"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IAudioEndpointVolume {
    int _0(); int _1(); int _2(); int _3(); int _4(); int _5(); int _6(); int _7();
    int SetMasterVolumeLevelScalar(float fLevel, System.Guid pguidEventContext);
    int _9();
    int GetMasterVolumeLevelScalar(out float pfLevel);
    int _11(); int _12();
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
      } else {
        return toolResponse(toolName, { success: false, error: 'Debes especificar level (0-100) o action (mute/unmute/up/down).' });
      }
      await execAsync(`powershell -NoProfile -Command "${psCmd.replace(/"/g, '\\"')}"`, { timeout: 10000, windowsHide: true });
      const actionMsg = toolArgs.action
        ? (toolArgs.action === 'mute' ? 'Silenciado' : toolArgs.action === 'unmute' ? 'Desilenciado' : toolArgs.action === 'up' ? 'Volumen subido' : 'Volumen bajado')
        : `Volumen ajustado a ${toolArgs.level}%`;
      return toolResponse(toolName, { success: true, message: actionMsg });
    } catch (err: any) { return toolError(toolName, err.message); }
  }

  if (toolName === 'toggle_wifi') {
    try {
      const action = toolArgs.enable ? 'enable' : 'disable';
      await execAsync(
        `powershell -NoProfile -Command "$adapter = Get-NetAdapter -Physical | Where-Object { $_.MediaType -eq '802.3' -or $_.Name -match 'Wi-Fi|WiFi|Wireless|WLAN' -and $_.InterfaceDescription -match 'Wi-Fi|WiFi|Wireless|WLAN' } | Select-Object -First 1; if (-not $adapter) { $adapter = Get-NetAdapter | Where-Object { $_.Name -match 'Wi-Fi|WiFi|Wireless|WLAN' } | Select-Object -First 1 }; if ($adapter) { ${action === 'enable' ? 'Enable-NetAdapter' : 'Disable-NetAdapter'} -Name $adapter.Name -Confirm:$false } else { throw 'No se encontró adaptador Wi-Fi' }"`,
        { timeout: 15000, windowsHide: true }
      );
      return toolResponse(toolName, { success: true, message: toolArgs.enable ? 'Wi-Fi activado.' : 'Wi-Fi desactivado.' });
    } catch (err: any) { return toolError(toolName, err.message); }
  }

  if (toolName === 'run_in_terminal') {
    try {
      const workDir = toolArgs.working_directory || os.homedir();
      const keepOpen = toolArgs.keep_open !== false;
      const noExitFlag = keepOpen ? '-NoExit' : '';
      const psArgs = [noExitFlag, '-Command', `Set-Location '${workDir.replace(/'/g, "''")}'; ${toolArgs.command}`].filter(Boolean);
      const child = spawn('powershell.exe', psArgs, { detached: true, stdio: 'ignore', windowsHide: false });
      child.unref();
      return toolResponse(toolName, { success: true, message: `Terminal abierta ejecutando: ${toolArgs.command}\nDirectorio: ${workDir}` });
    } catch (err: any) { return toolError(toolName, err.message); }
  }

  if (toolName === 'run_claude_code') {
    try {
      const projectDir = toolArgs.project_directory || os.homedir();
      const task = toolArgs.task || '';
      const claudePaths = [
        'C:\\Users\\' + os.userInfo().username + '\\AppData\\Roaming\\npm\\claude.cmd',
        'C:\\Users\\' + os.userInfo().username + '\\AppData\\Local\\npm-cache\\_npx\\claude.cmd',
      ];
      let claudePath = 'claude';
      for (const cp of claudePaths) {
        try { await execAsync(`if exist "${cp}" echo found`, { windowsHide: true }); claudePath = cp; break; } catch { /* continue */ }
      }
      const psCmd = `Set-Location '${projectDir.replace(/'/g, "''")}'; & '${claudePath}' --print '${task.replace(/'/g, "''")}'`;
      const child = spawn('powershell.exe', ['-NoExit', '-Command', psCmd], { detached: true, stdio: 'ignore', windowsHide: false });
      child.unref();
      return toolResponse(toolName, { success: true, message: `Claude Code lanzado en: ${projectDir}\nTarea: ${task}` });
    } catch (err: any) { return toolError(toolName, err.message); }
  }

  return null;
}
