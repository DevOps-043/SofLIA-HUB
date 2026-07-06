import { spawn as nodeSpawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { createInterface, type Interface } from 'node:readline';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { POWERSHELL_WORKER_SCRIPT } from './worker-script';
import {
  decodeResponseLine,
  encodeRequest,
  type WorkerRequest,
  type WorkerResponse,
} from './worker-protocol';

type SpawnFn = (command: string, args: string[]) => ChildProcessWithoutNullStreams;

/** Omit distributivo: preserva el discriminante `cmd` de la unión WorkerRequest. */
type WithoutId<T> = T extends { id: number } ? Omit<T, 'id'> : never;

export type PowerShellWorkerOptions = {
  /** Timeout por petición (ms). */
  requestTimeoutMs?: number;
  /** Inyectable para tests; por defecto child_process.spawn. */
  spawn?: SpawnFn;
  /** Ruta del script; por defecto se escribe a un temporal. */
  scriptPath?: string;
};

type PendingRequest = {
  resolve: (value: WorkerResponse) => void;
  reject: (error: Error) => void;
  timer: NodeJS.Timeout;
};

const DEFAULT_REQUEST_TIMEOUT_MS = 12000;
const MAX_RESTART_BACKOFF_MS = 8000;

/**
 * Worker de PowerShell de larga vida para UI Automation. Un único proceso
 * compila los ensamblados UIA una sola vez y atiende peticiones JSON por STDIN,
 * eliminando el límite de 8191 caracteres de `-EncodedCommand` y la latencia de
 * arranque por llamada (~1-3 s → <100 ms tras el warm-up).
 */
export class PowerShellWorker {
  private child: ChildProcessWithoutNullStreams | null = null;
  private stdoutReader: Interface | null = null;
  private readonly pending = new Map<number, PendingRequest>();
  private nextId = 1;
  private disposed = false;
  private restartCount = 0;
  private readonly requestTimeoutMs: number;
  private readonly spawnFn: SpawnFn;
  private resolvedScriptPath: string | null = null;
  private readonly scriptPathOverride?: string;

  constructor(options: PowerShellWorkerOptions = {}) {
    this.requestTimeoutMs = options.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
    this.spawnFn = options.spawn ?? ((command, args) => nodeSpawn(command, args) as ChildProcessWithoutNullStreams);
    this.scriptPathOverride = options.scriptPath;
  }

  isRunning(): boolean {
    return this.child !== null && !this.disposed;
  }

  /** Envía una petición y espera su respuesta correlacionada por id. */
  async send(request: WithoutId<WorkerRequest>): Promise<WorkerResponse> {
    if (this.disposed) throw new Error('El worker de PowerShell fue liberado.');
    this.ensureStarted();
    const id = this.nextId++;
    const full = { ...request, id } as WorkerRequest;

    return new Promise<WorkerResponse>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Petición ${request.cmd} al worker excedió ${this.requestTimeoutMs}ms.`));
      }, this.requestTimeoutMs);

      this.pending.set(id, { resolve, reject, timer });
      try {
        this.child!.stdin.write(`${encodeRequest(full)}\n`);
      } catch (err) {
        this.pending.delete(id);
        clearTimeout(timer);
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    });
  }

  dispose(): void {
    this.disposed = true;
    this.rejectAllPending(new Error('Worker liberado.'));
    this.teardownChild();
  }

  private ensureStarted(): void {
    if (this.child) return;
    const scriptPath = this.ensureScriptFile();
    const child = this.spawnFn('powershell', [
      '-NoProfile',
      '-ExecutionPolicy',
      'Bypass',
      '-File',
      scriptPath,
    ]);
    this.child = child;

    this.stdoutReader = createInterface({ input: child.stdout });
    this.stdoutReader.on('line', (line) => this.handleLine(line));

    child.on('exit', () => this.handleChildExit());
    child.on('error', () => this.handleChildExit());
  }

  private ensureScriptFile(): string {
    if (this.scriptPathOverride) return this.scriptPathOverride;
    if (this.resolvedScriptPath && fs.existsSync(this.resolvedScriptPath)) return this.resolvedScriptPath;
    const target = path.join(os.tmpdir(), 'soflia-uia-worker.ps1');
    fs.writeFileSync(target, POWERSHELL_WORKER_SCRIPT, 'utf8');
    this.resolvedScriptPath = target;
    return target;
  }

  private handleLine(line: string): void {
    const response = decodeResponseLine(line);
    if (!response) return; // Ruido de PowerShell fuera del protocolo.
    const pending = this.pending.get(response.id);
    if (!pending) return;
    this.pending.delete(response.id);
    clearTimeout(pending.timer);
    pending.resolve(response);
  }

  private handleChildExit(): void {
    if (this.disposed) return;
    this.rejectAllPending(new Error('El worker de PowerShell se cerró inesperadamente.'));
    this.teardownChild();
    // El próximo send() relanza; el backoff evita reinicios en caliente si algo
    // hace crashear repetidamente el proceso.
    this.restartCount++;
    const backoff = Math.min(MAX_RESTART_BACKOFF_MS, 250 * 2 ** Math.min(this.restartCount, 5));
    console.warn(`[DesktopAgent] Worker UIA caído; se relanzará bajo demanda (backoff ${backoff}ms).`);
  }

  private teardownChild(): void {
    if (this.stdoutReader) {
      this.stdoutReader.close();
      this.stdoutReader = null;
    }
    if (this.child) {
      try { this.child.stdin.end(); } catch { /* ignore */ }
      try { this.child.kill(); } catch { /* ignore */ }
      this.child = null;
    }
  }

  private rejectAllPending(error: Error): void {
    for (const [, pending] of this.pending) {
      clearTimeout(pending.timer);
      pending.reject(error);
    }
    this.pending.clear();
  }
}
