// =============================================================================
// SofLIA Hub - PythonToolsService (documentos + privacidad)
// =============================================================================
// Cliente del sidecar de herramientas (python/tools_sidecar). Proceso SEPARADO
// del sidecar de voz: aquel tiene el microfono en exclusiva y los modelos Vosk
// residentes, y un fallo parseando un PDF corrupto no debe tumbar la escucha.
//
// Arranque PEREZOSO: el proceso solo se lanza en la primera peticion real.
// Degradacion elegante: si el runtime Python no esta, `isAvailable()` es false
// y quien llama sigue su camino habitual (nunca se rompe una funcion existente).
// =============================================================================
import { EventEmitter } from 'node:events';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { app } from 'electron';
import path from 'node:path';
import fs from 'node:fs';

export interface DocumentTable {
  rows: string[][];
  page?: number;
  sheet?: string;
  slide?: number;
  index?: number;
}

export interface ParsedDocument {
  markdown: string;
  tables: DocumentTable[];
  metadata: Record<string, unknown>;
}

export interface PiiEntity {
  type: string;
  start: number;
  end: number;
}

export interface RedactionResult {
  redacted: string;
  entities: PiiEntity[];
  engine: string;
  redactedCount: number;
}

export interface SidecarError {
  code: string;
  message: string;
  recoverable: boolean;
}

export type ToolsResult<T> =
  | { success: true; data: T }
  | { success: false; error: SidecarError };

interface PendingRequest {
  resolve: (value: ToolsResult<unknown>) => void;
  timer: NodeJS.Timeout;
}

const DOCUMENT_TIMEOUT_MS = 60_000; // pdfplumber puede tardar en PDFs largos
const QUICK_TIMEOUT_MS = 10_000;
const MAX_RESTARTS = 3;

/** Formatos que el sidecar sabe leer y el resto del sistema NO. */
export const SIDECAR_DOCUMENT_EXTENSIONS = ['.pdf', '.xlsx', '.xlsm', '.pptx', '.docx'];

export function isSidecarDocument(filePath: string): boolean {
  return SIDECAR_DOCUMENT_EXTENSIONS.includes(path.extname(filePath).toLowerCase());
}

export interface PrivacyConfig {
  /** Redactar la PII de los documentos antes de que lleguen al modelo. */
  redactDocuments: boolean;
}

const DEFAULT_PRIVACY_CONFIG: PrivacyConfig = {
  // OPT-IN a proposito: activarlo por defecto cambiaria en silencio el contenido
  // que ve el modelo. El usuario decide.
  redactDocuments: false,
};

export class PythonToolsService extends EventEmitter {
  private proc: ChildProcessWithoutNullStreams | null = null;
  private pending = new Map<number, PendingRequest>();
  private nextId = 1;
  private stdoutBuffer = '';
  private restarts = 0;
  private stopping = false;
  private startPromise: Promise<void> | null = null;
  private lastError: string | null = null;
  private privacy: PrivacyConfig = { ...DEFAULT_PRIVACY_CONFIG };
  private privacyLoaded = false;

  /** true si el runtime Python y el sidecar existen en disco. */
  isAvailable(): boolean {
    return fs.existsSync(this.getPythonPath()) && fs.existsSync(this.getSidecarPath());
  }

  getStatus(): { available: boolean; running: boolean; lastError: string | null; privacy: PrivacyConfig } {
    return {
      available: this.isAvailable(),
      running: this.proc !== null,
      lastError: this.lastError,
      privacy: this.getPrivacyConfig(),
    };
  }

  getPrivacyConfig(): PrivacyConfig {
    if (!this.privacyLoaded) {
      this.privacyLoaded = true;
      try {
        const raw = fs.readFileSync(this.getPrivacyConfigPath(), 'utf8');
        this.privacy = { ...DEFAULT_PRIVACY_CONFIG, ...(JSON.parse(raw) as Partial<PrivacyConfig>) };
      } catch {
        this.privacy = { ...DEFAULT_PRIVACY_CONFIG };
      }
    }
    return { ...this.privacy };
  }

  setPrivacyConfig(updates: Partial<PrivacyConfig>): PrivacyConfig {
    this.privacy = { ...this.getPrivacyConfig(), ...updates };
    try {
      fs.writeFileSync(this.getPrivacyConfigPath(), JSON.stringify(this.privacy, null, 2), 'utf8');
    } catch (error) {
      console.error(`[PythonTools] No se pudo guardar privacy.json: ${error instanceof Error ? error.message : error}`);
    }
    return { ...this.privacy };
  }

  /**
   * Lee un documento. Si la redaccion esta activada, la PII se elimina DENTRO
   * del sidecar: el dato sensible nunca llega a Electron ni, por tanto, al modelo.
   */
  async parseDocument(filePath: string, maxPages = 200): Promise<ToolsResult<ParsedDocument>> {
    return this.send<ParsedDocument>('parse_document', {
      file_path: filePath,
      max_pages: maxPages,
      redact: this.getPrivacyConfig().redactDocuments,
    }, DOCUMENT_TIMEOUT_MS);
  }

  async redactText(text: string): Promise<ToolsResult<RedactionResult>> {
    return this.send<RedactionResult>('redact_text', { text }, QUICK_TIMEOUT_MS);
  }

  async analyzePii(text: string): Promise<ToolsResult<{ entities: PiiEntity[]; engine: string }>> {
    return this.send('analyze_pii', { text }, QUICK_TIMEOUT_MS);
  }

  async stop(): Promise<void> {
    this.stopping = true;
    const proc = this.proc;
    if (!proc) return;
    try {
      await this.send('shutdown', {}, 2_000);
    } catch { /* se fuerza el kill abajo */ }
    if (!proc.killed) proc.kill();
    this.proc = null;
  }

  // ── Internals ──────────────────────────────────────────────────────────────

  private async send<T>(cmd: string, params: Record<string, unknown>, timeoutMs: number): Promise<ToolsResult<T>> {
    if (!this.isAvailable()) {
      return {
        success: false,
        error: {
          code: 'SIDECAR_UNAVAILABLE',
          message: 'El runtime Python no esta instalado. Ejecuta "npm run python:setup" o reinstala la app.',
          recoverable: true,
        },
      };
    }
    try {
      await this.ensureProcess();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.lastError = message;
      return { success: false, error: { code: 'SIDECAR_START_FAILED', message, recoverable: true } };
    }

    const id = this.nextId++;
    return await new Promise<ToolsResult<T>>((resolve) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        resolve({
          success: false,
          error: { code: 'TIMEOUT', message: `El sidecar no respondio a '${cmd}' en ${timeoutMs} ms.`, recoverable: true },
        });
      }, timeoutMs);
      this.pending.set(id, { resolve: resolve as (value: ToolsResult<unknown>) => void, timer });

      const payload = `${JSON.stringify({ id, cmd, params })}\n`;
      this.proc?.stdin.write(payload, (writeError) => {
        if (!writeError) return;
        clearTimeout(timer);
        this.pending.delete(id);
        resolve({
          success: false,
          error: { code: 'SIDECAR_WRITE_FAILED', message: writeError.message, recoverable: true },
        });
      });
    });
  }

  private ensureProcess(): Promise<void> {
    if (this.proc) return Promise.resolve();
    if (this.startPromise) return this.startPromise;
    if (this.restarts >= MAX_RESTARTS) {
      // Evita un bucle de arranque/crash. El contador se resetea con un
      // arranque sano (evento 'ready') o al reiniciar la app.
      return Promise.reject(new Error('El sidecar de herramientas fallo repetidamente; se deshabilito hasta reiniciar la app.'));
    }

    this.startPromise = new Promise<void>((resolve, reject) => {
      const proc = spawn(this.getPythonPath(), ['-u', this.getSidecarPath()], {
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true,
        env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
      });
      this.proc = proc;
      this.stopping = false;
      this.stdoutBuffer = '';

      const readyTimer = setTimeout(() => reject(new Error('Timeout esperando el arranque del sidecar de herramientas.')), 15_000);
      const onReady = () => { clearTimeout(readyTimer); resolve(); };
      this.once('ready', onReady);

      proc.stdout.setEncoding('utf8');
      proc.stdout.on('data', (chunk: string) => this.handleStdout(chunk));
      proc.stderr.setEncoding('utf8');
      proc.stderr.on('data', (chunk: string) => {
        const text = chunk.trim();
        if (text) console.warn(`[PythonTools][stderr] ${text}`);
      });
      proc.on('exit', (code) => this.handleExit(code));
      proc.on('error', (error) => {
        clearTimeout(readyTimer);
        this.lastError = error.message;
        reject(error);
      });
    });

    void this.startPromise.finally(() => { this.startPromise = null; });
    return this.startPromise;
  }

  private handleStdout(chunk: string): void {
    this.stdoutBuffer += chunk;
    let newlineIndex = this.stdoutBuffer.indexOf('\n');
    while (newlineIndex !== -1) {
      const line = this.stdoutBuffer.slice(0, newlineIndex).trim();
      this.stdoutBuffer = this.stdoutBuffer.slice(newlineIndex + 1);
      if (line) this.handleMessage(line);
      newlineIndex = this.stdoutBuffer.indexOf('\n');
    }
  }

  private handleMessage(line: string): void {
    let msg: Record<string, unknown>;
    try {
      msg = JSON.parse(line) as Record<string, unknown>;
    } catch {
      console.warn(`[PythonTools] Linea no-JSON del sidecar: ${line.slice(0, 200)}`);
      return;
    }

    if (msg.event === 'ready') {
      this.restarts = 0; // arranque sano: se recupera el presupuesto de reintentos
      this.emit('ready');
      return;
    }
    if (msg.event === 'error') {
      this.lastError = String(msg.message ?? 'Error del sidecar de herramientas');
      console.error(`[PythonTools] ${this.lastError}`);
      return;
    }

    if (typeof msg.id !== 'number') return;
    const pending = this.pending.get(msg.id);
    if (!pending) return;
    clearTimeout(pending.timer);
    this.pending.delete(msg.id);

    if (msg.ok === true) {
      pending.resolve({ success: true, data: (msg.data ?? {}) as never });
      return;
    }
    const error = (msg.error ?? {}) as Partial<SidecarError>;
    pending.resolve({
      success: false,
      error: {
        code: String(error.code ?? 'UNKNOWN'),
        message: String(error.message ?? 'Error desconocido del sidecar.'),
        recoverable: error.recoverable === true,
      },
    });
  }

  private handleExit(code: number | null): void {
    this.proc = null;
    for (const [, pending] of this.pending) {
      clearTimeout(pending.timer);
      pending.resolve({
        success: false,
        error: { code: 'SIDECAR_CRASHED', message: 'El sidecar de herramientas termino inesperadamente.', recoverable: true },
      });
    }
    this.pending.clear();
    if (this.stopping) return;
    if (code !== 0) {
      this.restarts += 1;
      console.warn(`[PythonTools] Sidecar finalizo con codigo ${code}. Reintentos usados: ${this.restarts}/${MAX_RESTARTS}.`);
    }
    // No se relanza aqui: el arranque es perezoso y la siguiente peticion lo
    // revive (si aun quedan reintentos).
    if (this.restarts >= MAX_RESTARTS) {
      this.lastError = 'El sidecar de herramientas fallo repetidamente; se deshabilita hasta reiniciar la app.';
    }
  }

  private getPythonPath(): string {
    return app.isPackaged
      ? path.join(process.resourcesPath, 'python', 'python.exe')
      : path.join(app.getAppPath(), 'python-runtime', 'python.exe');
  }

  private getSidecarPath(): string {
    return app.isPackaged
      ? path.join(process.resourcesPath, 'python-tools', 'main.py')
      : path.join(app.getAppPath(), 'python', 'tools_sidecar', 'main.py');
  }

  private getPrivacyConfigPath(): string {
    return path.join(app.getPath('userData'), 'privacy-config.json');
  }
}

export const pythonToolsService = new PythonToolsService();
