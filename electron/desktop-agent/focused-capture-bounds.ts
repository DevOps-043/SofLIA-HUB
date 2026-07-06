import type { DesktopAgentConfig } from '../desktop-agent-types';
import type { ScreenshotVirtualBounds } from './types';
import { getVirtualDesktopBounds, intersectBounds } from './screenshot-bounds';
import { physicalRectToDipRect } from './screenshot-coordinates';

export type EncodedPowerShellExecutor = (script: string, timeout?: number) => Promise<string>;

export type PhysicalToDipRectConverter = (rect: ScreenshotVirtualBounds) => ScreenshotVirtualBounds;

export type ForegroundWindowBounds = {
  title: string;
  process: string;
  /** Bounds en DIP (ya convertidos desde los pixeles fisicos de GetWindowRect). */
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

/**
 * Ventana en primer plano con bounds en DIP. GetWindowRect devuelve pixeles
 * FISICOS; aqui se convierten a DIP antes de usarlos con los bounds de
 * Electron (que son DIP) — sin esta conversion, cualquier monitor con escala
 * distinta de 100% produce doble escalado en los clicks.
 */
export async function getForegroundWindowDipBounds(
  psEncoded: EncodedPowerShellExecutor,
  convertRect: PhysicalToDipRectConverter = physicalRectToDipRect,
): Promise<ForegroundWindowBounds | null> {
  try {
    const stdout = await psEncoded(FOREGROUND_WINDOW_SCRIPT, 3000);
    const parsed = JSON.parse(stdout || '{}') as Partial<Record<'title' | 'process' | 'x' | 'y' | 'width' | 'height', string | number>>;
    const width = Number(parsed.width || 0);
    const height = Number(parsed.height || 0);
    if (!Number.isFinite(width) || !Number.isFinite(height) || width < 120 || height < 120) return null;

    const physicalBounds = { x: Number(parsed.x || 0), y: Number(parsed.y || 0), width, height };
    const dipBounds = convertRect(physicalBounds);
    if (dipBounds.x !== physicalBounds.x || dipBounds.width !== physicalBounds.width) {
      console.log(
        `[DesktopAgent] Ventana enfocada: fisico (${physicalBounds.x},${physicalBounds.y} ${physicalBounds.width}x${physicalBounds.height}) -> dip (${Math.round(dipBounds.x)},${Math.round(dipBounds.y)} ${Math.round(dipBounds.width)}x${Math.round(dipBounds.height)})`,
      );
    }
    return {
      title: String(parsed.title || ''),
      process: String(parsed.process || ''),
      bounds: dipBounds,
    };
  } catch {
    return null;
  }
}

export async function getFocusedCaptureBounds(
  config: DesktopAgentConfig,
  psEncoded: EncodedPowerShellExecutor,
  convertRect: PhysicalToDipRectConverter = physicalRectToDipRect,
): Promise<ScreenshotVirtualBounds | null> {
  const focusedWindow = await getForegroundWindowDipBounds(psEncoded, convertRect);
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
