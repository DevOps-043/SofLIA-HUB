import { execFile } from 'node:child_process';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import type { BrowserWindow } from 'electron';
import { BrowserCredentialError } from './credential-errors';
import { windowsHelloScript } from './windows-hello-source';

export const CREDENTIAL_UNLOCK_MS = 5 * 60_000;
export type CredentialVerifier = (parent: BrowserWindow, signal: AbortSignal) => Promise<boolean>;

export const verifyWindowsCredential: CredentialVerifier = async (parent, signal) => {
  if (process.platform !== 'win32' || parent.isDestroyed() || !parent.isVisible() || signal.aborted) return false;
  const bytes = parent.getNativeWindowHandle();
  const handle = bytes.length === 8 ? bytes.readBigUInt64LE() : bytes.length === 4 ? BigInt(bytes.readUInt32LE()) : 0n;
  if (!handle) return false;
  const encoded = Buffer.from(windowsHelloScript(handle), 'utf16le').toString('base64');
  // Ruta del sistema, no PATH, sin shell ni datos del sitio en el comando.
  const systemRoot = process.env.SystemRoot;
  if (!systemRoot || !path.win32.isAbsolute(systemRoot)) return false;
  // ProcessEnv exige variables de Vite para la app, pero el verificador no debe heredarlas.
  const env: Record<string, string | undefined> = { SystemRoot: systemRoot, WINDIR: systemRoot,
    PATH: path.join(systemRoot, 'System32'),
    PSModulePath: path.join(systemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'Modules') };
  for (const name of ['TEMP', 'TMP']) if (process.env[name]) env[name] = process.env[name];
  return new Promise(resolve => {
    execFile(path.join(systemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe'),
      ['-NoLogo', '-NoProfile', '-NonInteractive', '-MTA', '-EncodedCommand', encoded],
      { windowsHide: true, timeout: 60_000, maxBuffer: 1024, signal, env: env as NodeJS.ProcessEnv },
      (error, stdout) => resolve(!error && !signal.aborted && stdout === 'verified'));
  });
};

/** Lease sólo en memoria; un bloqueo revoca también las revisiones pendientes. */
export class BrowserCredentialUnlock {
  private revision = 0;
  private until = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private pending: AbortController | null = null;
  constructor(private readonly changed: () => void, private readonly verify: CredentialVerifier = verifyWindowsCredential) {}
  isUnlocked(): boolean { return this.until > performance.now(); }
  capture(): () => void {
    const revision = this.revision;
    const guard = () => {
      if (revision !== this.revision || !this.isUnlocked()) throw new BrowserCredentialError('La bóveda está bloqueada. Desbloquéala con Windows para continuar.');
    };
    guard(); return guard;
  }
  lock(): void {
    ++this.revision; this.until = 0;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null; this.pending?.abort(); this.changed();
  }
  async unlock(parent: BrowserWindow, assertCurrent: () => void): Promise<boolean> {
    if (this.pending) throw new BrowserCredentialError('Ya hay una verificación de Windows pendiente.');
    this.lock(); assertCurrent();
    const controller = new AbortController(); this.pending = controller;
    const revision = this.revision; const started = performance.now();
    try {
      const verified = await this.verify(parent, controller.signal);
      assertCurrent();
      if (!verified || controller.signal.aborted || revision !== this.revision || performance.now() - started >= 60_000) return false;
      this.until = performance.now() + CREDENTIAL_UNLOCK_MS;
      this.timer = setTimeout(() => this.lock(), CREDENTIAL_UNLOCK_MS); this.timer.unref?.();
      this.changed(); return true;
    } finally { if (this.pending === controller) this.pending = null; }
  }
}
