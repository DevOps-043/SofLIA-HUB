// Ejecutor PowerShell propio de esta capacidad.
//
// Usa -EncodedCommand porque los scripts son multilinea y aplanarlos a `;`
// rompe los bloques try/catch que sostienen la degradacion de la cascada.
// Es deliberadamente independiente de `DesktopAgentService`: leer una ventana no
// debe depender de que haya una tarea de escritorio en curso.

import { exec as execCb } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(execCb);

export type EncodedPowerShell = (script: string, timeoutMs: number) => Promise<string>;

export const runEncodedPowerShell: EncodedPowerShell = async (script, timeoutMs) => {
  if (process.platform !== 'win32') {
    throw new Error('PowerShell solo esta disponible en Windows.');
  }
  const encoded = Buffer.from(script, 'utf16le').toString('base64');
  const { stdout } = await execAsync(`powershell -NoProfile -EncodedCommand ${encoded}`, {
    timeout: timeoutMs,
    windowsHide: true,
    maxBuffer: 16 * 1024 * 1024,
  });
  return stdout?.trim() || '';
};

/** Extrae el primer JSON del stdout, tolerando ruido de PowerShell alrededor. */
export function parseJsonOutput<T>(stdout: string): T | null {
  const match = stdout.match(/[[{][\s\S]*[\]}]/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]) as T;
  } catch {
    return null;
  }
}
