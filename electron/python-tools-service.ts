// =============================================================================
// Soflia Hub - PythonToolsService (documentos + privacidad)
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
import { SidecarConnection, SidecarConnectionError, sidecarLaunchError, sidecarStopError } from './python/sidecar-connection';
import { app } from 'electron';
import path from 'node:path';
import fs from 'node:fs';

import type { ParsedDocument, PiiEntity, RedactionResult, PrivacyConfig } from '../src/shared/python-tools';
export type { DocumentTable, ParsedDocument, PiiEntity, RedactionResult, PrivacyConfig } from '../src/shared/python-tools';
import { PythonPrivacyStore } from './python/privacy-store';
import { createLogger } from './utils/logger';
import { assertToolsOperation, projectDocument, projectPii, projectRedaction, toolsFailure, validateToolsText, type PythonToolsOperationContext } from './python/tools-contract';
export type { PythonToolsOperationContext } from './python/tools-contract';
const log = createLogger('python-tools');
export interface SidecarError {
  code: string;
  message: string;
  recoverable: boolean;
}

export type ToolsResult<T> =
  | { success: true; data: T }
  | { success: false; error: SidecarError };

const DOCUMENT_TIMEOUT_MS = 60_000; // pdfplumber puede tardar en PDFs largos
const QUICK_TIMEOUT_MS = 10_000;
const MAX_RESTARTS = 3;

/** Formatos que el sidecar sabe leer y el resto del sistema NO. */
export const SIDECAR_DOCUMENT_EXTENSIONS = ['.pdf', '.xlsx', '.xlsm', '.pptx', '.docx'];

export function isSidecarDocument(filePath: string): boolean {
  return SIDECAR_DOCUMENT_EXTENSIONS.includes(path.extname(filePath).toLowerCase());
}

export class PythonToolsService extends EventEmitter {
  private connection: SidecarConnection | null = null;
  private retiring: SidecarConnection | null = null;
  private restarts = 0;
  private stopPromise: Promise<void> | null = null;
  private lifecycleVersion = 0;
  private lastError: string | null = null;
  private readonly closingReaders = new Set<SidecarConnection>();
  private readonly privacyStore = new PythonPrivacyStore(() => this.getPrivacyConfigPath(), () => {
    void this.stop().catch(() => log.warn({ code: 'SIDECAR_STOP_UNCONFIRMED' }, 'No se confirmó el cierre del lector al cambiar privacidad.'));
  });


  /** true si el runtime Python y el sidecar existen en disco. */
  isAvailable(): boolean {
    return fs.existsSync(this.getPythonPath()) && fs.existsSync(this.getSidecarPath());
  }

  getStatus(): { available: boolean; running: boolean; lastError: string | null; privacy: PrivacyConfig } {
    return {
      available: this.isAvailable(),
      running: this.connection !== null,
      lastError: this.lastError,
      privacy: this.getPrivacyConfig(),
    };
  }

  getPrivacyConfig(): PrivacyConfig { return this.privacyStore.get(); }
  setPrivacyConfig(updates: Partial<PrivacyConfig>): PrivacyConfig { return this.privacyStore.set(updates); }
  capturePrivacyContext() { return this.privacyStore.capture(); }
  /**
   * Lee un documento. Si la redaccion esta activada, la PII se elimina DENTRO
   * del sidecar: el dato sensible nunca llega a Electron ni, por tanto, al modelo.
   */
  async parseDocument(filePath: string, maxPages = 200, context?: PythonToolsOperationContext): Promise<ToolsResult<ParsedDocument>> {
    try {
      assertToolsOperation(context);
      if (typeof filePath !== 'string' || !filePath || filePath.length > 4096 || filePath.includes('\0') || !path.isAbsolute(filePath)
        || !isSidecarDocument(filePath) || !Number.isSafeInteger(maxPages) || maxPages < 1 || maxPages > 200) throw new Error('TOOLS_INVALID_INPUT');
      const policy = this.capturePrivacyContext();
      return await this.send<ParsedDocument>('parse_document', { file_path: filePath, max_pages: maxPages, redact: policy.config.redactDocuments },
        DOCUMENT_TIMEOUT_MS, { signal: context?.signal, assertCurrent: () => { policy.assertCurrent(); assertToolsOperation(context); } });
    } catch (error) { return toolsFailure(error instanceof Error ? error.message : undefined); }
  }

  async redactText(text: string, context?: PythonToolsOperationContext): Promise<ToolsResult<RedactionResult>> {
    try { validateToolsText(text); assertToolsOperation(context); return await this.send<RedactionResult>('redact_text', { text }, QUICK_TIMEOUT_MS, context); }
    catch (error) { return toolsFailure(error instanceof Error ? error.message : undefined); }
  }

  async analyzePii(text: string, context?: PythonToolsOperationContext): Promise<ToolsResult<{ entities: PiiEntity[]; engine: string }>> {
    try { validateToolsText(text); assertToolsOperation(context); return await this.send('analyze_pii', { text }, QUICK_TIMEOUT_MS, context); }
    catch (error) { return toolsFailure(error instanceof Error ? error.message : undefined); }
  }

  async stop(): Promise<void> {
    this.lifecycleVersion++;
    if (this.stopPromise) return this.stopPromise;
    const connection = this.connection ?? this.retiring; this.connection = null;
    if (connection) this.trackClosing(connection);
    const operation = connection?.stop() ?? Promise.resolve(); this.stopPromise = operation;
    try { await operation; }
    catch (error) {
      if (connection && error instanceof SidecarConnectionError && error.code === 'SIDECAR_STOP_UNCONFIRMED') {
        this.trackRetiring(connection); this.lastError = error.message;
      }
      throw error;
    }
    finally { if (this.stopPromise === operation) this.stopPromise = null; }
  }

  // ── Internals ──────────────────────────────────────────────────────────────

  /** La copia pertenece al selector main; cierre sin confirmar difiere su limpieza. */
  async releaseDocumentCopy(remove: () => Promise<void>): Promise<boolean> {
    if (this.closingReaders.size) {
      void Promise.all([...this.closingReaders].map(reader => reader.closed)).then(remove)
        .catch(() => log.warn({ code: 'DOCUMENT_CLEANUP_PENDING' }, 'No se confirmó la limpieza de una copia temporal.'));
      return false;
    }
    try { await remove(); return true; }
    catch { log.warn({ code: 'DOCUMENT_CLEANUP_PENDING' }, 'No se confirmó la limpieza de una copia temporal.'); return false; }
  }

  private async send<T>(cmd: string, params: Record<string, unknown>, timeoutMs: number, context?: PythonToolsOperationContext): Promise<ToolsResult<T>> {
    const version = this.lifecycleVersion; let started = false;
    const cancel = () => { if (version === this.lifecycleVersion) void this.stop().catch(() => log.warn({ code: 'SIDECAR_STOP_UNCONFIRMED' }, 'No se confirmó el cierre del lector cancelado.')); };
    try {
      assertToolsOperation(context);
      if (!this.isAvailable()) return toolsFailure('SIDECAR_UNAVAILABLE');
      context?.signal?.addEventListener('abort', cancel, { once: true }); started = true;
      const connection = await this.ensureProcess();
      assertToolsOperation(context);
      if (version !== this.lifecycleVersion || connection !== this.connection) throw new SidecarConnectionError('SIDECAR_STOPPED', 'La petición Python fue cancelada.');
      const response = await connection.request(cmd, params, timeoutMs);
      assertToolsOperation(context);
      if (version !== this.lifecycleVersion || connection !== this.connection) throw new SidecarConnectionError('SIDECAR_STOPPED', 'La petición Python fue cancelada.');
      if (response.ok === true) {
        const data = cmd === 'parse_document' ? projectDocument(response.data, params.redact === true)
          : cmd === 'redact_text' ? projectRedaction(response.data, params.text as string) : projectPii(response.data, params.text as string);
        return { success: true, data: data as T };
      }
      const error = response.error && typeof response.error === 'object' ? response.error as Partial<SidecarError> : {};
      return toolsFailure(error.code);
    } catch (error) {
      let code = error instanceof SidecarConnectionError ? error.code : error instanceof Error ? error.message : undefined;
      // Una petición retirada no puede sobrescribir el diagnóstico del hijo nuevo.
      if (version === this.lifecycleVersion) this.lastError = toolsFailure(code).error.message;
      if (started && version === this.lifecycleVersion) {
        try { await this.stop(); } catch { code = 'SIDECAR_STOP_UNCONFIRMED'; }
      }
      return toolsFailure(code);
    } finally { context?.signal?.removeEventListener('abort', cancel); }
  }

  private async ensureProcess(): Promise<SidecarConnection> {
    const version = this.lifecycleVersion;
    if (this.stopPromise) await this.stopPromise;
    if (version !== this.lifecycleVersion) throw new SidecarConnectionError('SIDECAR_STOPPED', 'El arranque Python fue cancelado.');
    if (this.retiring) throw sidecarStopError();
    if (this.connection) { const current = this.connection; await current.start(); return current; }
    if (this.restarts >= MAX_RESTARTS) throw new SidecarConnectionError('SIDECAR_START_FAILED', 'El sidecar de herramientas falló repetidamente; reinicia la app.');
    let proc: ChildProcessWithoutNullStreams;
    try { proc = spawn(this.getPythonPath(), ['-u', this.getSidecarPath()], {
      stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true, env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
    }); } catch (error) { this.restarts++; throw sidecarLaunchError(error); }
    const connection = new SidecarConnection(proc, { protocol: 1, readyTimeoutMs: 15_000,
      onMessage: message => {
        if (this.connection !== connection) return;
        if (message.event === 'ready') { this.restarts = 0; this.lastError = null; this.emit('ready'); }
        else if (message.event === 'error') this.lastError = 'El sidecar de herramientas informó un error.';
      },
      onClosed: (error, intentional) => {
        if (this.connection !== connection) return;
        this.connection = null; this.lifecycleVersion++; this.lastError = error.message;
        if (error.code === 'SIDECAR_STOP_UNCONFIRMED') this.trackRetiring(connection);
        if (!intentional) this.restarts++;
      },
    });
    this.connection = connection; await connection.start(); return connection;
  }

  private trackRetiring(connection: SidecarConnection): void {
    this.trackClosing(connection);
    this.retiring = connection;
    void connection.closed.then(() => { if (this.retiring === connection) this.retiring = null; });
  }
  private trackClosing(connection: SidecarConnection): void {
    this.closingReaders.add(connection); void connection.closed.then(() => { this.closingReaders.delete(connection); });
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

