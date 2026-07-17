import { execFile } from 'node:child_process';

type ActiveWinModule = {
  default: () => Promise<{ title?: string; owner?: { name?: string }; url?: string } | undefined>;
};

let activeWinModule: ActiveWinModule | null = null;
/**
 * active-win requiere ffi-napi en Windows, que esta abandonado y no compila en
 * Electron moderno. Tras el primer fallo se deja de intentar (evita spamear el
 * log cada poll) y en Windows se usa el fallback PowerShell P/Invoke — el mismo
 * mecanismo que ya usa el desktop-agent para la ventana enfocada.
 */
let activeWinBroken = false;

const WINDOWS_FOREGROUND_SCRIPT = `
$source = @"
using System;
using System.Runtime.InteropServices;
using System.Text;

namespace W {
  public static class FgWin {
    [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);
    [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);
  }
}
"@

Add-Type -TypeDefinition $source
$hwnd = [W.FgWin]::GetForegroundWindow()
if ($hwnd -eq [IntPtr]::Zero) { @{} | ConvertTo-Json -Compress; exit }
$sb = New-Object System.Text.StringBuilder 1024
[void][W.FgWin]::GetWindowText($hwnd, $sb, $sb.Capacity)
$procId = [uint32]0
[void][W.FgWin]::GetWindowThreadProcessId($hwnd, [ref]$procId)
$proc = Get-Process -Id $procId -ErrorAction SilentlyContinue
@{
  title = $sb.ToString()
  process = if ($proc) { $proc.ProcessName } else { '' }
} | ConvertTo-Json -Compress
`;

function getForegroundWindowViaPowerShell(): Promise<{ title: string; process: string } | null> {
  return new Promise((resolve) => {
    const encoded = Buffer.from(WINDOWS_FOREGROUND_SCRIPT, 'utf16le').toString('base64');
    execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', encoded],
      { timeout: 5000, windowsHide: true },
      (error, stdout) => {
        if (error) {
          console.warn('[ActiveWindow] Fallback PowerShell fallo:', error.message);
          return resolve(null);
        }
        try {
          const parsed = JSON.parse(stdout.trim() || '{}') as { title?: string; process?: string };
          if (!parsed.title && !parsed.process) return resolve(null);
          resolve({ title: parsed.title || 'Unknown', process: parsed.process || 'Unknown' });
        } catch {
          resolve(null);
        }
      },
    );
  });
}

export async function getActiveWindowInfo(): Promise<{ title: string; process: string; url?: string } | null> {
  if (!activeWinBroken) {
    try {
      if (!activeWinModule) activeWinModule = await import('active-win') as ActiveWinModule;
      const win = await activeWinModule.default();
      if (!win) return null;
      return {
        title: win.title || 'Unknown',
        process: win.owner?.name || 'Unknown',
        url: win.url || undefined,
      };
    } catch (err) {
      activeWinBroken = true;
      const reason = (err instanceof Error ? err.message : String(err)).split('\n')[0];
      console.warn(
        `[ActiveWindow] active-win no disponible (${reason});`
        + (process.platform === 'win32' ? ' usando fallback PowerShell.' : ' sin fallback en esta plataforma.'),
      );
    }
  }
  if (process.platform === 'win32') return getForegroundWindowViaPowerShell();
  return null;
}
