import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execute = promisify(execFile);

/** No aplana C# ni interpreta comillas; un error de entrada nunca termina con exit 0. */
export async function runPowerShellInput(script: string, timeout = 10000, signal?: AbortSignal): Promise<string> {
  if (process.platform !== 'win32') throw new Error('PowerShell/Win32 sólo está disponible en Windows.');
  const guarded = `$ErrorActionPreference = 'Stop'\ntry {\n${script}\n} catch {\n[Console]::Error.WriteLine('No se pudo ejecutar la operación de escritorio.'); exit 1\n}`;
  const encoded = Buffer.from(guarded, 'utf16le').toString('base64');
  const { stdout } = await execute('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', encoded], { timeout, windowsHide: true, signal });
  return stdout.trim();
}
