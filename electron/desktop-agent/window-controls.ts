import { execFile as execFileCb } from 'node:child_process';
import fs from 'node:fs';
import { promisify } from 'node:util';
import { assertGuiAutomationSupported, detectPlatformCapabilities } from '../platform-capabilities';

export type PowerShellExecutor = (script: string) => Promise<string>;
const execFileAsync = promisify(execFileCb);

type ProcessWindowInfo = {
  Id?: number;
  ProcessName?: string;
  MainWindowTitle?: string;
};

export class DesktopWindowControls {
  constructor(private readonly ps: PowerShellExecutor) {}

  /**
   * Trae una ventana al frente de forma confiable. Windows rechaza
   * SetForegroundWindow cuando el proceso llamador esta en segundo plano; por
   * eso se combina con: restaurar si esta minimizada (IsIconic),
   * SwitchToThisWindow (equivalente a Alt+Tab) como fallback, y verificacion
   * final con GetForegroundWindow.
   */
  async focusWindow(titleSubstring: string): Promise<boolean> {
    if (process.platform !== 'win32') {
      const windowId = await findLinuxWindowId(titleSubstring);
      if (!windowId) return false;
      await runXdotool(['windowactivate', '--sync', windowId]);
      return true;
    }
    const safe = titleSubstring.replace(/'/g, "''");
    const result = await this.ps(`
Add-Type -Name Win32 -Namespace W -MemberDefinition '
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
  [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern void SwitchToThisWindow(IntPtr hWnd, bool fAltTab);
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
'
$proc = Get-Process | Where-Object { $_.MainWindowTitle -like "*${safe}*" } | Select-Object -First 1
if ($proc) {
  $hwnd = $proc.MainWindowHandle
  if ([W.Win32]::IsIconic($hwnd)) { [void][W.Win32]::ShowWindow($hwnd, 9) }
  [void][W.Win32]::SetForegroundWindow($hwnd)
  Start-Sleep -Milliseconds 120
  if ([W.Win32]::GetForegroundWindow() -ne $hwnd) {
    [W.Win32]::SwitchToThisWindow($hwnd, $true)
    Start-Sleep -Milliseconds 120
  }
  if ([W.Win32]::GetForegroundWindow() -eq $hwnd) { Write-Output "OK" } else { Write-Output "NO_FOREGROUND" }
} else {
  Write-Output "NOT_FOUND"
}`);
    if (result.includes('NO_FOREGROUND')) {
      console.warn(`[DesktopAgent] focusWindow: "${titleSubstring}" quedo visible pero Windows nego el primer plano.`);
      return true;
    }
    return result.includes('OK');
  }

  minimizeWindow(titleSubstring: string): Promise<boolean> {
    return this.windowAction(titleSubstring, 6);
  }

  maximizeWindow(titleSubstring: string): Promise<boolean> {
    return this.windowAction(titleSubstring, 3);
  }

  restoreWindow(titleSubstring: string): Promise<boolean> {
    return this.windowAction(titleSubstring, 9);
  }

  async closeWindow(titleSubstring: string): Promise<boolean> {
    if (process.platform !== 'win32') {
      const windowId = await findLinuxWindowId(titleSubstring);
      if (!windowId) return false;
      await runXdotool(['windowclose', windowId]);
      return true;
    }
    const safe = titleSubstring.replace(/'/g, "''");
    const result = await this.ps(`
$proc = Get-Process | Where-Object { $_.MainWindowTitle -like "*${safe}*" } | Select-Object -First 1
if ($proc) {
  $proc.CloseMainWindow() | Out-Null
  Write-Output "OK"
} else {
  Write-Output "NOT_FOUND"
}`);
    return result.includes('OK');
  }

  async listWindows(): Promise<Array<{ title: string; process: string; pid: number }>> {
    if (process.platform !== 'win32') {
      return listLinuxWindows();
    }
    const result = await this.ps(
      `Get-Process | Where-Object { $_.MainWindowTitle -ne '' } | Select-Object Id, ProcessName, MainWindowTitle | ConvertTo-Json -Compress`,
    );
    try {
      const parsed = JSON.parse(result) as ProcessWindowInfo | ProcessWindowInfo[];
      const arr = (Array.isArray(parsed) ? parsed : [parsed]) as ProcessWindowInfo[];
      return arr.map((processInfo) => ({
        title: processInfo.MainWindowTitle || '',
        process: processInfo.ProcessName || '',
        pid: processInfo.Id || 0,
      }));
    } catch {
      return [];
    }
  }

  async getActiveWindow(): Promise<{ title: string; process: string } | null> {
    // En Windows, el paquete `active-win` devuelve null en muchos entornos
    // (helper nativo no disponible), lo que rompia el window-lock (re-enfocaba en
    // cada paso al no poder verificar la ventana activa). GetForegroundWindow por
    // PowerShell es fiable y no depende de binarios extra.
    if (process.platform === 'win32') {
      const fromPs = await this.getActiveWindowWindows();
      if (fromPs) return fromPs;
    }
    try {
      const activeWin = await import('active-win');
      const win = await activeWin.default();
      if (win) return { title: win.title, process: win.owner.name };
    } catch {
      // fallback
    }
    if (process.platform !== 'win32') {
      return getLinuxActiveWindow();
    }
    return null;
  }

  private async getActiveWindowWindows(): Promise<{ title: string; process: string } | null> {
    try {
      const out = await this.ps(`
Add-Type -Name AwWin -Namespace W -MemberDefinition '
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetWindowText(IntPtr hWnd, System.Text.StringBuilder text, int count);
  [DllImport("user32.dll")] public static extern int GetWindowThreadProcessId(IntPtr hWnd, out uint processId);
'
$hwnd = [W.AwWin]::GetForegroundWindow()
if ($hwnd -eq [IntPtr]::Zero) { Write-Output '{}' } else {
  $sb = New-Object System.Text.StringBuilder 512
  [void][W.AwWin]::GetWindowText($hwnd, $sb, $sb.Capacity)
  $procId = [uint32]0
  [void][W.AwWin]::GetWindowThreadProcessId($hwnd, [ref]$procId)
  $procName = ''
  try { $procName = (Get-Process -Id $procId -ErrorAction Stop).ProcessName } catch {}
  ([PSCustomObject]@{ title = $sb.ToString(); process = $procName } | ConvertTo-Json -Compress)
}`);
      const match = out.match(/\{[\s\S]*\}/);
      if (!match) return null;
      const parsed = JSON.parse(match[0]) as { title?: string; process?: string };
      const title = (parsed.title ?? '').trim();
      const processName = (parsed.process ?? '').trim();
      if (!title && !processName) return null;
      return { title, process: processName };
    } catch {
      return null;
    }
  }

  private async windowAction(titleSubstring: string, showCmd: number): Promise<boolean> {
    if (process.platform !== 'win32') {
      const windowId = await findLinuxWindowId(titleSubstring);
      if (!windowId) return false;
      if (showCmd === 6) {
        await runXdotool(['windowminimize', windowId]);
        return true;
      }
      await runXdotool(['windowactivate', '--sync', windowId]);
      await runXdotool(['key', '--clearmodifiers', 'alt+F10']);
      return true;
    }
    const safe = titleSubstring.replace(/'/g, "''");
    const result = await this.ps(`
Add-Type -Name Win32 -Namespace W -MemberDefinition '
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
'
$proc = Get-Process | Where-Object { $_.MainWindowTitle -like "*${safe}*" } | Select-Object -First 1
if ($proc) {
  [W.Win32]::ShowWindow($proc.MainWindowHandle, ${showCmd})
  Write-Output "OK"
} else {
  Write-Output "NOT_FOUND"
}`);
    return result.includes('OK');
  }
}

async function findLinuxWindowId(titleSubstring: string): Promise<string | null> {
  const query = titleSubstring.trim() || '.';
  const stdout = await runXdotool(['search', '--onlyvisible', '--name', query]).catch(() => '');
  return stdout.split(/\r?\n/).map((line) => line.trim()).find(Boolean) || null;
}

async function listLinuxWindows(): Promise<Array<{ title: string; process: string; pid: number }>> {
  const stdout = await runXdotool(['search', '--onlyvisible', '--name', '.']).catch(() => '');
  const ids = stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).slice(0, 100);
  const windows: Array<{ title: string; process: string; pid: number }> = [];
  for (const id of ids) {
    const title = await runXdotool(['getwindowname', id]).catch(() => '');
    const pidText = await runXdotool(['getwindowpid', id]).catch(() => '0');
    const pid = Number(pidText.trim()) || 0;
    windows.push({ title: title.trim(), process: getLinuxProcessName(pid), pid });
  }
  return windows.filter((win) => win.title);
}

async function getLinuxActiveWindow(): Promise<{ title: string; process: string } | null> {
  const id = (await runXdotool(['getactivewindow']).catch(() => '')).trim();
  if (!id) return null;
  const title = (await runXdotool(['getwindowname', id]).catch(() => '')).trim();
  const pid = Number((await runXdotool(['getwindowpid', id]).catch(() => '0')).trim()) || 0;
  if (!title) return null;
  return { title, process: getLinuxProcessName(pid) };
}

function getLinuxProcessName(pid: number): string {
  if (!pid) return '';
  try {
    return fs.readFileSync(`/proc/${pid}/comm`, 'utf8').trim();
  } catch {
    return '';
  }
}

async function runXdotool(args: string[]): Promise<string> {
  const capabilities = detectPlatformCapabilities();
  assertGuiAutomationSupported(capabilities);
  if (!capabilities.linuxXdotool) throw new Error(capabilities.unsupportedReason || 'xdotool solo se usa en Linux X11.');
  try {
    const { stdout } = await execFileAsync('xdotool', args, { timeout: 10000, windowsHide: true });
    return stdout?.trim() || '';
  } catch (err: any) {
    throw new Error(`No se pudo ejecutar xdotool. Instala xdotool y usa una sesion X11. Detalle: ${err.message}`);
  }
}
