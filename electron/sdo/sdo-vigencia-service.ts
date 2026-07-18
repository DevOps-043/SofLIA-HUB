/**
 * Vigencia del SDO: la fecha mas reciente no prevalece; la vigencia si.
 *
 * Polling diario (sin webhooks, patron del proyecto):
 *  1. Registros 'vigente' con valid_until en el pasado pasan a 'vencido'
 *     (+ evento de bitacora con actor 'sistema').
 *  2. Registros 'vigente' con review_due proximo (7 dias) generan alerta.
 *
 * Emite 'alerta-vigencia' con un mensaje en espanol listo para WhatsApp;
 * quien escucha decide el canal (se cablea en el arranque del Hub).
 */
import { EventEmitter } from 'node:events';
import { getSdoHubClient } from './sdo-hub-client';
import { registrarEvento } from './sdo-audit';
import { nowIso, throwOnSdoError } from './sdo-shared';

const DIA_MS = 24 * 60 * 60 * 1000;
const VENTANA_REVISION_MS = 7 * DIA_MS;

interface TablaGobernada {
  tabla: string;
  objectType: 'decision' | 'claim' | 'action';
  labelField: string;
  conValidUntil: boolean;
}

const TABLAS: TablaGobernada[] = [
  { tabla: 'sdo_decisions', objectType: 'decision', labelField: 'statement', conValidUntil: true },
  { tabla: 'sdo_claims', objectType: 'claim', labelField: 'statement', conValidUntil: true },
  { tabla: 'sdo_actions', objectType: 'action', labelField: 'description', conValidUntil: false },
];

export interface ResultadoVigencia {
  vencidos: Array<{ objectType: string; id: string; label: string }>;
  porRevisar: Array<{ objectType: string; id: string; label: string; review_due: string }>;
}

export class SdoVigenciaService extends EventEmitter {
  private interval: NodeJS.Timeout | null = null;

  constructor(private readonly intervalMs = DIA_MS) {
    super();
  }

  start(): void {
    if (this.interval) return;
    this.interval = setInterval(() => { void this.revisarSeguro(); }, this.intervalMs);
    setTimeout(() => { void this.revisarSeguro(); }, 15000);
    console.log('[SdoVigencia] Polling de vigencia iniciado (cada 24 h).');
  }

  stop(): void {
    if (!this.interval) return;
    clearInterval(this.interval);
    this.interval = null;
  }

  isRunning(): boolean {
    return this.interval !== null;
  }

  private async revisarSeguro(): Promise<void> {
    try {
      await this.revisar();
    } catch (error) {
      console.warn('[SdoVigencia] Revision de vigencia fallo (se reintenta en el proximo ciclo):', error instanceof Error ? error.message : error);
    }
  }

  async revisar(ahora = new Date()): Promise<ResultadoVigencia> {
    const supabase = getSdoHubClient();
    const ahoraIso = ahora.toISOString();
    const limiteRevision = new Date(ahora.getTime() + VENTANA_REVISION_MS).toISOString();
    const resultado: ResultadoVigencia = { vencidos: [], porRevisar: [] };

    for (const { tabla, objectType, labelField, conValidUntil } of TABLAS) {
      if (conValidUntil) {
        const { data: filasVencidas, error } = await supabase
          .from(tabla)
          .select('*')
          .eq('temporal_status', 'vigente')
          .lt('valid_until', ahoraIso);
        throwOnSdoError(error, `vigencia.selectVencidos.${tabla}`);

        for (const fila of (filasVencidas || []) as Array<Record<string, unknown>>) {
          const id = fila.id as string;
          const { error: errorUpdate } = await supabase
            .from(tabla)
            .update({ temporal_status: 'vencido', updated_at: nowIso() })
            .eq('id', id);
          throwOnSdoError(errorUpdate, `vigencia.marcarVencido.${tabla}`);

          await registrarEvento({
            actor_type: 'sistema',
            event_type: 'vencido',
            object_type: objectType,
            object_id: id,
            reason: 'valid_until superado; detectado por el ciclo de vigencia.',
            trace_id: (fila.trace_id as string | null) ?? null,
          });

          resultado.vencidos.push({ objectType, id, label: String(fila[labelField] ?? '') });
        }
      }

      const { data: filasRevision, error: errorRevision } = await supabase
        .from(tabla)
        .select('*')
        .eq('temporal_status', 'vigente')
        .lte('review_due', limiteRevision);
      throwOnSdoError(errorRevision, `vigencia.selectRevision.${tabla}`);

      for (const fila of (filasRevision || []) as Array<Record<string, unknown>>) {
        if (!fila.review_due) continue;
        resultado.porRevisar.push({
          objectType,
          id: fila.id as string,
          label: String(fila[labelField] ?? ''),
          review_due: fila.review_due as string,
        });
      }
    }

    if (resultado.vencidos.length > 0 || resultado.porRevisar.length > 0) {
      this.emit('alerta-vigencia', {
        mensaje: construirMensajeVigencia(resultado),
        ...resultado,
      });
    }

    return resultado;
  }
}

export function construirMensajeVigencia(resultado: ResultadoVigencia): string {
  const lineas: string[] = ['⚠️ *SDO — Revision de vigencia*'];

  if (resultado.vencidos.length > 0) {
    lineas.push('', `*Registros vencidos (${resultado.vencidos.length}):* ya no deben tratarse como vigentes.`);
    for (const item of resultado.vencidos.slice(0, 10)) {
      lineas.push(`• [${item.objectType}] ${recortar(item.label)}`);
    }
  }

  if (resultado.porRevisar.length > 0) {
    lineas.push('', `*Por revisar en 7 dias (${resultado.porRevisar.length}):*`);
    for (const item of resultado.porRevisar.slice(0, 10)) {
      lineas.push(`• [${item.objectType}] ${recortar(item.label)} — revision: ${item.review_due.slice(0, 10)}`);
    }
  }

  return lineas.join('\n');
}

function recortar(texto: string, max = 90): string {
  return texto.length > max ? `${texto.slice(0, max - 1)}…` : texto;
}
