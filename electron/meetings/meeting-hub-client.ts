import type { SupabaseClient } from '@supabase/supabase-js';
import { getHubDbClient } from '../hub-db-client';

/** Persistencia propia de Soflia Hub en Lia. */
export function getMeetingHubClient(): SupabaseClient {
  return getHubDbClient();
}
