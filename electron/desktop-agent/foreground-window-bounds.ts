import type { ScreenshotVirtualBounds } from './types';

export type ForegroundWindowBounds = {
  title: string;
  process: string;
  bounds: ScreenshotVirtualBounds;
};

type PowerShellRunner = (script: string, timeout?: number) => Promise<string>;

export async function getForegroundWindowBounds(
  runPowerShell: PowerShellRunner,
): Promise<ForegroundWindowBounds | null> {
  try {
    const stdout = await runPowerShell(FOREGROUND_WINDOW_SCRIPT, 3000);
    const parsed = JSON.parse(stdout || '{}') as {
      title?: string;
      process?: string;
      x?: number;
      y?: number;
      width?: number;
      height?: number;
    };

    const width = Number(parsed.width || 0);
    const height = Number(parsed.height || 0);
    if (!Number.isFinite(width) || !Number.isFinite(height) || width < 120 || height < 120) {
      return null;
    }

    return {
      title: String(parsed.title || ''),
      process: String(parsed.process || ''),
      bounds: { x: Number(parsed.x || 0), y: Number(parsed.y || 0), width, height },
    };
  } catch {
    return null;
  }
}

const FOREGROUND_WINDOW_SCRIPT = `
$source = @"
using System;
using System.Runtime.InteropServices;
using System.Text;

namespace W {
  public static class FgWin {
    [StructLayout(LayoutKind.Sequential)]
    public struct RECT {
      public int Left;
      public int Top;
      public int Right;
      public int Bottom;
    }

    [DllImport("user32.dll")]
    public static extern IntPtr GetForegroundWindow();

    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);

    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static extern bool GetWindowRect(IntPtr hWnd, out RECT rect);

    [DllImport("user32.dll")]
    public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);
  }
}
"@

Add-Type -TypeDefinition $source

$hwnd = [W.FgWin]::GetForegroundWindow()
if ($hwnd -eq [IntPtr]::Zero) {
  @{} | ConvertTo-Json -Compress
  exit
}

$sb = New-Object System.Text.StringBuilder 1024
[void][W.FgWin]::GetWindowText($hwnd, $sb, $sb.Capacity)
$rect = New-Object W.FgWin+RECT
[void][W.FgWin]::GetWindowRect($hwnd, [ref]$rect)
$pid = [uint32]0
[void][W.FgWin]::GetWindowThreadProcessId($hwnd, [ref]$pid)
$proc = Get-Process -Id $pid -ErrorAction SilentlyContinue

@{
  title = $sb.ToString()
  process = if ($proc) { $proc.ProcessName } else { '' }
  x = $rect.Left
  y = $rect.Top
  width = [Math]::Max(0, $rect.Right - $rect.Left)
  height = [Math]::Max(0, $rect.Bottom - $rect.Top)
} | ConvertTo-Json -Compress
`;
