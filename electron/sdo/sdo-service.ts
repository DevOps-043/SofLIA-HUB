/**
 * SdoService — fachada del Registro Operativo Gobernado (SDO-AN).
 *
 * Fase 1: expone el store y el estado del adaptador de meetings.
 * El polling de vigencia (vencidos, review_due) llega en la Fase 2
 * via start(); por ahora start() no hace nada.
 */
import { EventEmitter } from 'node:events';
import { SdoDocumentService } from './sdo-document-service';
import { SdoStore } from './sdo-store';
import { SdoVigenciaService } from './sdo-vigencia-service';
import type { SdoServiceStatus } from './sdo-types';

export class SdoService extends EventEmitter {
  readonly store: SdoStore;
  readonly vigencia: SdoVigenciaService;
  readonly documentos: SdoDocumentService;
  private initialized = false;
  private lastAdapterError: string | null = null;
  private lastAdapterRunId: string | null = null;
  private lastAdapterAt: string | null = null;

  constructor(store = new SdoStore(), vigencia = new SdoVigenciaService(), documentos?: SdoDocumentService) {
    super();
    this.store = store;
    this.vigencia = vigencia;
    this.documentos = documentos ?? new SdoDocumentService(store);
    // Re-emitir para que el arranque del Hub cablee la notificacion (WhatsApp).
    this.vigencia.on('alerta-vigencia', (payload) => this.emit('alerta-vigencia', payload));
  }

  async init(): Promise<void> {
    this.initialized = true;
  }

  start(): void {
    this.vigencia.start();
  }

  stop(): void {
    this.vigencia.stop();
  }

  getConfig(): Record<string, unknown> {
    return {};
  }

  getStatus(): SdoServiceStatus {
    return {
      initialized: this.initialized,
      lastAdapterError: this.lastAdapterError,
      lastAdapterRunId: this.lastAdapterRunId,
      lastAdapterAt: this.lastAdapterAt,
    };
  }

  /** El adaptador reporta cada corrida para diagnostico via sdo:get-status. */
  reportarResultadoAdapter(runId: string, error: string | null): void {
    this.lastAdapterRunId = runId;
    this.lastAdapterError = error;
    this.lastAdapterAt = new Date().toISOString();
    if (error) {
      // Evento propio ('error' sin listener tumbaria el proceso).
      this.emit('adapter-error', { runId, error });
      console.warn(`[SDO] Adaptador de meetings fallo para el run ${runId}: ${error}`);
    }
  }
}
