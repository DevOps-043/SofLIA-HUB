/**
 * SdoService — fachada del Registro Operativo Gobernado (SDO-AN).
 *
 * Fase 1: expone el store y el estado del adaptador de meetings.
 * El polling de vigencia (vencidos, review_due) llega en la Fase 2
 * via start(); por ahora start() no hace nada.
 */
import { EventEmitter } from 'node:events';
import { SdoStore } from './sdo-store';
import type { SdoServiceStatus } from './sdo-types';

export class SdoService extends EventEmitter {
  readonly store: SdoStore;
  private initialized = false;
  private lastAdapterError: string | null = null;
  private lastAdapterRunId: string | null = null;
  private lastAdapterAt: string | null = null;

  constructor(store = new SdoStore()) {
    super();
    this.store = store;
  }

  async init(): Promise<void> {
    this.initialized = true;
  }

  start(): void {
    // Fase 2: aqui arranca el polling de vigencia.
  }

  stop(): void {
    // Fase 2: aqui se detiene el polling de vigencia.
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
