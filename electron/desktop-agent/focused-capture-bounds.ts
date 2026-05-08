import type { DesktopAgentConfig } from '../desktop-agent-types';
import type { ScreenshotVirtualBounds } from './types';
import { getVirtualDesktopBounds, intersectBounds } from './screenshot-bounds';

export type EncodedPowerShellExecutor = (script: string, timeout?: number) => Promise<string>;

type ForegroundWindowBounds = {
  title: string;
  process: string;
  bounds: ScreenshotVirtualBounds;
};

const FOREGROUND_WINDOW_SCRIPT = `
$source = @"
using System;
using System.Runtime.InteropServices;
using System.Text;

namespace W {
  public static class FgWin {
    [StructLayout(LayoutKind.Sequential)]
    public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }
    [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);
    [DllImport("user32.dll")] [return: MarshalAs(UnmanagedType.Bool)] public static extern bool GetWindowRect(IntPtr hWnd, out RECT rect);
    [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);
  }
}
"@

Add-Type -TypeDefinition $source
$hwnd = [W.FgWin]::GetForegroundWindow()
if ($hwnd -eq [IntPtr]::Zero) { @{} | ConvertTo-Json -Compress; exit }
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

async function getForegroundWindowBounds(psEncoded: EncodedPowerShellExecutor): Promise<ForegroundWindowBounds | null> {
  try {
    const stdout = await psEncoded(FOREGROUND_WINDOW_SCRIPT, 3000);
    const parsed = JSON.parse(stdout || '{}') as Partial<Record<'title' | 'process' | 'x' | 'y' | 'width' | 'height', string | number>>;
    const width = Number(parsed.width || 0);
    const height = Number(parsed.height || 0);
    if (!Number.isFinite(width) || !Number.isFinite(height) || width < 120 || height < 120) return null;

    return {
      title: String(parsed.title || ''),
      process: String(parsed.process || ''),
      bounds: { x: Number(parsed.x || 0), y: Number(parsed.y || 0), width, height },
    };
  } catch {
    return null;
  }
}

export async function getFocusedCaptureBounds(
  config: DesktopAgentConfig,
  psEncoded: EncodedPowerShellExecutor,
): Promise<ScreenshotVirtualBounds | null> {
  if (!config.focusedCaptureEnabled) return null;
  const focusedWindow = await getForegroundWindowBounds(psEncoded);
  if (!focusedWindow) return null;

  const normalizedTitle = `${focusedWindow.title} ${focusedWindow.process}`.toLowerCase();
  if (!normalizedTitle.trim() || normalizedTitle.includes('program manager')) return null;

  const padding = Math.max(0, config.focusedCapturePadding || 0);
  const paddedBounds = {
    x: focusedWindow.bounds.x - padding,
    y: focusedWindow.bounds.y - padding,
    width: focusedWindow.bounds.width + (padding * 2),
    height: focusedWindow.bounds.height + (padding * 2),
  };
  return intersectBounds(getVirtualDesktopBounds(), paddedBounds);
}
