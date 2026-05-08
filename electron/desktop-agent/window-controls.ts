export type PowerShellExecutor = (script: string) => Promise<string>;

type ProcessWindowInfo = {
  Id?: number;
  ProcessName?: string;
  MainWindowTitle?: string;
};

export class DesktopWindowControls {
  constructor(private readonly ps: PowerShellExecutor) {}

  async focusWindow(titleSubstring: string): Promise<boolean> {
    const safe = titleSubstring.replace(/'/g, "''");
    const result = await this.ps(`
Add-Type -Name Win32 -Namespace W -MemberDefinition '
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
'
$proc = Get-Process | Where-Object { $_.MainWindowTitle -like "*${safe}*" } | Select-Object -First 1
if ($proc) {
  [W.Win32]::ShowWindow($proc.MainWindowHandle, 9)
  [W.Win32]::SetForegroundWindow($proc.MainWindowHandle)
  Write-Output "OK"
} else {
  Write-Output "NOT_FOUND"
}`);
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
    try {
      const activeWin = await import('active-win');
      const win = await activeWin.default();
      if (win) return { title: win.title, process: win.owner.name };
    } catch {
      // fallback
    }
    return null;
  }

  private async windowAction(titleSubstring: string, showCmd: number): Promise<boolean> {
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
