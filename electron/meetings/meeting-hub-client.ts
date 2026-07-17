import type { SupabaseClient } from '@supabase/supabase-js';
import { getHubDbClient } from '../hub-db-client';

/**
 * Cliente de PERSISTENCIA de Meeting Ops: la base de datos de SofLIA Hub.
 * A IRIS solo se le COMPARTE el resultado aprobado (issues/proyectos) via
 * iris-data-main en meeting-sync. Las bases no se mezclan.
 */
export function getMeetingHubClient(): SupabaseClient {
  return getHubDbClient();
}
