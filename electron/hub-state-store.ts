/**
 * Respaldo del estado de servicios en la BASE DE DATOS DE SOFLIA HUB.
 *
 * Problema que resuelve: workflows, plantillas y tareas programadas vivian
 * SOLO en JSON locales (userData/); un formateo o cambio de maquina los
 * borraba. Ahora cada archivo de estado se espeja en la tabla
 * `hub_service_state` (una fila por servicio, JSONB con el estado completo).
 *
 * Modelo operativo (a nivel ARCHIVO, sin conocer la forma del estado):
 *  - Al iniciar cada servicio: `restoreHubStateFile` — si el Hub tiene estado,
 *    sobreescribe el archivo local ANTES de que el servicio lo cargue (la BD
 *    es la fuente de verdad: sobrevive al formateo). Si el Hub esta vacio y
 *    el archivo local tiene contenido, se migra al Hub automaticamente.
 *  - Tras cada guardado: `mirrorHubStateFile` — sube el archivo recien
 *    escrito (fire-and-forget; sin red, el local sigue funcionando y el
 *    proximo guardado re-espeja).
 *
 * Limite conocido: ultima escritura gana entre maquinas con la misma base
 * (el estado es por instalacion de Hub, no colaborativo).
 */
import fs from 'node:fs';
import path from 'node:path';
import { getHubDbClient } from './hub-db-client';

const TABLE = 'hub_service_state';
/** No spamear el log si el Hub no esta disponible: un aviso por servicio/10min. */
const WARN_THROTTLE_MS = 10 * 60_000;
const lastWarnAt = new Map<string, number>();

export type HubStateRestoreResult = 'restaurado' | 'migrado-local' | 'vacio' | 'no-disponible';

function warnThrottled(serviceName: string, message: string): void {
  const now = Date.now();
  if (now - (lastWarnAt.get(serviceName) ?? 0) < WARN_THROTTLE_MS) return;
  lastWarnAt.set(serviceName, now);
  console.warn(`[HubStateStore] ${message}`);
}

function readLocalStateFile(filePath: string): unknown | null {
  try {
    if (!fs.existsSync(filePath)) return null;
    const raw = fs.readFileSync(filePath, 'utf-8').trim();
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    // Archivo corrupto: no migrarlo al Hub (no propagar basura).
    return null;
  }
}

async function upsertState(serviceName: string, state: unknown): Promise<void> {
  const { error } = await getHubDbClient()
    .from(TABLE)
    .upsert(
      { service_name: serviceName, state_json: state, updated_at: new Date().toISOString() },
      { onConflict: 'service_name' },
    );
  if (error) throw new Error(error.message);
}

/**
 * Restaura el archivo de estado desde el Hub (o migra el local al Hub la
 * primera vez). Llamar ANTES de que el servicio cargue su archivo. Nunca
 * lanza: sin red o sin tabla, el servicio arranca con su archivo local.
 */
export async function restoreHubStateFile(serviceName: string, filePath: string): Promise<HubStateRestoreResult> {
  try {
    const { data, error } = await getHubDbClient()
      .from(TABLE)
      .select('state_json')
      .eq('service_name', serviceName)
      .maybeSingle();
    if (error) throw new Error(error.message);

    if (data && data.state_json !== null && data.state_json !== undefined) {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, JSON.stringify(data.state_json, null, 2), 'utf-8');
      console.log(`[HubStateStore] Estado de "${serviceName}" restaurado desde la base del Hub.`);
      return 'restaurado';
    }

    const localState = readLocalStateFile(filePath);
    if (localState !== null) {
      await upsertState(serviceName, localState);
      console.log(`[HubStateStore] Estado local de "${serviceName}" migrado a la base del Hub.`);
      return 'migrado-local';
    }
    return 'vacio';
  } catch (err) {
    warnThrottled(serviceName, `No pude sincronizar "${serviceName}" con la base del Hub (se usa el archivo local): ${err instanceof Error ? err.message : String(err)}`);
    return 'no-disponible';
  }
}

/**
 * Espeja el archivo de estado recien guardado hacia el Hub. Fire-and-forget:
 * los guardados locales NUNCA se bloquean por la red.
 */
export function mirrorHubStateFile(serviceName: string, filePath: string): void {
  const state = readLocalStateFile(filePath);
  if (state === null) return;
  void upsertState(serviceName, state).catch((err) => {
    warnThrottled(serviceName, `No pude espejar "${serviceName}" al Hub (el archivo local esta a salvo): ${err instanceof Error ? err.message : String(err)}`);
  });
}
