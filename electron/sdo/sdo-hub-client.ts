import type { SupabaseClient } from '@supabase/supabase-js';
import { getHubDbClient } from '../hub-db-client';

/**
 * Cliente de PERSISTENCIA del SDO-AN: la base de datos de Pulse Hub.
 * El registro operativo gobernado (fuentes, evidencia, claims, decisiones,
 * acciones, aprobaciones, bitacora) vive en el Hub. A IRIS solo se le
 * comparte el resultado aprobado. Las bases no se mezclan.
 */
export function getSdoHubClient(): SupabaseClient {
  return getHubDbClient();
}
