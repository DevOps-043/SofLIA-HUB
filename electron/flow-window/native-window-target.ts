import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export interface FlowInsertTarget {
  handle: string;
  title: string;
}

export type NativeWindowErrorLogger = (context: string, error: unknown) => void;

export async function captureForegroundWindow(
  logError: NativeWindowErrorLogger,
): Promise<FlowInsertTarget | null> {
  try {
    const script = `
Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Text;
public static class ForegroundWindowReader {
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);
}
"@
$handle = [ForegroundWindowReader]::GetForegroundWindow()
$builder = New-Object System.Text.StringBuilder 512
[ForegroundWindowReader]::GetWindowText($handle, $builder, $builder.Capacity) | Out-Null
@{
  handle = "$($handle.ToInt64())"
  title = $builder.ToString()
} | ConvertTo-Json -Compress
`;
    const { stdout } = await execFileAsync('powershell.exe', ['-NoProfile', '-Command', script], {
      timeout: 3000,
      windowsHide: true,
    });
    const parsed = JSON.parse((stdout || '').trim()) as { handle?: string; title?: string };
    const handle = String(parsed.handle || '').trim();
    const title = String(parsed.title || '').trim();
    if (!handle || handle === '0') {
      return null;
    }
    return { handle, title };
  } catch (error) {
    logError('captureForegroundWindow', error);
    return null;
  }
}

export async function restoreFlowInsertTarget(
  target: FlowInsertTarget,
  logError: NativeWindowErrorLogger,
): Promise<void> {
  const script = `
Add-Type @"
using System;
using System.Runtime.InteropServices;
public static class FlowWindowFocus {
  [DllImport("user32.dll")] public static extern bool ShowWindowAsync(IntPtr hWnd, int nCmdShow);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
}
"@
$handle = [IntPtr]::new([int64]${target.handle})
[FlowWindowFocus]::ShowWindowAsync($handle, 9) | Out-Null
[FlowWindowFocus]::SetForegroundWindow($handle) | Out-Null
`;

  try {
    await execFileAsync('powershell.exe', ['-NoProfile', '-Command', script], {
      timeout: 2500,
      windowsHide: true,
    });
  } catch (error) {
    logError('restoreFlowInsertTarget', error);
  }
}
