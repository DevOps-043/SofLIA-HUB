import { exec as execCb } from 'node:child_process';
import { promisify } from 'node:util';
import type { WindowsUIAServiceCore } from './core';
import type { WindowsUIASnapshot } from './types';

const execAsync = promisify(execCb);

export async function collectSnapshot(service: WindowsUIAServiceCore): Promise<WindowsUIASnapshot> {
  const currentWindow = await getForegroundWindowInfo();
  const windows = await service.desktopAgent.listWindows().catch(() => []);
  const elements = await service.desktopAgent.getUIElements();
  const screenshotBase64 = await service.desktopAgent.takeScreenshot().catch(() => '');
  const signature = JSON.stringify({
    currentWindowTitle: currentWindow.title,
    currentProcess: currentWindow.process,
    windows: windows.slice(0, 8).map((window) => `${window.title}|${window.process}`),
    elements: elements.slice(0, 20).map((element) =>
      `${element.id}|${element.controlType}|${element.name}|${element.automationId || ''}|${element.value || ''}`,
    ),
  });
  return { currentWindowTitle: currentWindow.title, currentProcess: currentWindow.process, windows, elements, screenshotBase64, signature };
}

async function getForegroundWindowInfo(): Promise<{ title: string; process: string; pid: number }> {
  const { stdout } = await execAsync(`powershell -NoProfile -Command "
Add-Type -Name FgWin -Namespace W -MemberDefinition '[DllImport(\\\"user32.dll\\\")] public static extern IntPtr GetForegroundWindow(); [DllImport(\\\"user32.dll\\\", CharSet=CharSet.Unicode)] public static extern int GetWindowText(IntPtr hWnd, System.Text.StringBuilder text, int count); [DllImport(\\\"user32.dll\\\")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, [ref] uint processId);'
$hwnd = [W.FgWin]::GetForegroundWindow()
$sb = New-Object System.Text.StringBuilder 1024
[void][W.FgWin]::GetWindowText($hwnd, $sb, $sb.Capacity)
$pid = [uint32]0
[void][W.FgWin]::GetWindowThreadProcessId($hwnd, [ref]$pid)
$proc = Get-Process -Id $pid -ErrorAction SilentlyContinue
@{ title = $sb.ToString(); process = ($proc.ProcessName); pid = $pid } | ConvertTo-Json -Compress
"`, { timeout: 3000, windowsHide: true });
  const parsed = JSON.parse(stdout || '{}');
  return { title: parsed.title || '', process: parsed.process || '', pid: parsed.pid || 0 };
}
