import path from 'node:path';
import { execAsync } from './exec';
import { stripLaunchExtension } from './path-helpers';
import type { ExistingWindowMatch } from './types';

function escapePowerShellSingleQuoted(value: string): string {
  return value.replace(/'/g, "''");
}

function buildWindowSearchTokens(requestedPath: string, resolvedPath: string): string[] {
  const candidates = new Set<string>();
  const requestedBase = stripLaunchExtension(path.basename((requestedPath || '').trim()));
  const resolvedBase = stripLaunchExtension(path.basename((resolvedPath || '').trim()));

  for (const candidate of [requestedBase, resolvedBase, requestedPath, resolvedPath]) {
    const trimmed = String(candidate || '').trim();
    if (!trimmed) continue;
    candidates.add(trimmed);
    candidates.add(trimmed.replace(/[-_]+/g, ' '));
  }

  return Array.from(candidates)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2)
    .slice(0, 8);
}

export async function focusExistingApplicationWindow(
  requestedPath: string,
  resolvedPath: string,
): Promise<ExistingWindowMatch | null> {
  if (process.platform !== 'win32') return null;

  const tokens = buildWindowSearchTokens(requestedPath, resolvedPath);
  if (!tokens.length) return null;

  const tokenConditions = tokens
    .map((token) => {
      const safe = escapePowerShellSingleQuoted(token);
      return `$_.ProcessName -like '*${safe}*' -or $_.MainWindowTitle -like '*${safe}*'`;
    })
    .join(' -or ');

  if (!tokenConditions) return null;

  const script = `
Add-Type -Name Win32 -Namespace W -MemberDefinition '
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
'
$proc = Get-Process | Where-Object { $_.MainWindowHandle -ne 0 -and (${tokenConditions}) } | Sort-Object StartTime -Descending | Select-Object -First 1
if ($proc) {
  [W.Win32]::ShowWindow($proc.MainWindowHandle, 9) | Out-Null
  [W.Win32]::SetForegroundWindow($proc.MainWindowHandle) | Out-Null
  @{ pid = $proc.Id; process = $proc.ProcessName; title = $proc.MainWindowTitle } | ConvertTo-Json -Compress
}
`;

  try {
    const { stdout } = await execAsync(
      `powershell -NoProfile -Command "${script.replace(/\n/g, '; ').replace(/"/g, '\\"')}"`,
      { timeout: 4000, windowsHide: true, maxBuffer: 1024 * 128 },
    );
    const parsed = JSON.parse((stdout || '').trim());
    if (!parsed?.pid) return null;
    return {
      pid: Number(parsed.pid) || 0,
      process: String(parsed.process || ''),
      title: String(parsed.title || ''),
    };
  } catch {
    return null;
  }
}
