import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseFetch } from '../src/shared/supabase-http';

export interface MainSupabaseClientInput {
  url: string;
  key: string;
  serviceName: string;
}

export interface MainSupabaseClientResult {
  client: SupabaseClient | null;
  error?: string;
}

function isValidSupabaseUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && parsed.hostname.endsWith('.supabase.co');
  } catch {
    return false;
  }
}

export function createMainSupabaseClient(input: MainSupabaseClientInput): MainSupabaseClientResult {
  if (!input.url || !input.key) {
    return { client: null, error: `${input.serviceName} no tiene URL o key configurada.` };
  }

  if (!isValidSupabaseUrl(input.url)) {
    return { client: null, error: `${input.serviceName} tiene una URL Supabase invalida.` };
  }

  try {
    return {
      client: createClient(input.url, input.key, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
        global: {
          fetch: createSupabaseFetch({
            serviceName: input.serviceName,
            stripIncomingSignal: true,
          }),
        },
      }),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { client: null, error: `${input.serviceName} no pudo crear cliente: ${message}` };
  }
}
