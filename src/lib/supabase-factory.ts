/**
 * Supabase Factory — Renderer Process
 * Utilidades compartidas para crear clientes Supabase en Electron.
 * Elimina la duplicación de localStorageAdapter, isValidUrl y electronFetch.
 */
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseFetch } from '../shared/supabase-http';

/** Adapter de almacenamiento usando localStorage (Electron desktop) */
export const localStorageAdapter = {
  getItem: async (key: string): Promise<string | null> => {
    return localStorage.getItem(key);
  },
  setItem: async (key: string, value: string): Promise<void> => {
    localStorage.setItem(key, value);
  },
  removeItem: async (key: string): Promise<void> => {
    localStorage.removeItem(key);
  },
};

/** Valida que un string sea una URL válida */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Fetch resiliente para Electron renderer.
 * Mantiene el workaround de ignorar AbortSignal entrante, pero agrega timeout
 * propio y retries solo para lecturas idempotentes.
 */
export const electronFetch: typeof globalThis.fetch = createSupabaseFetch({
  serviceName: 'renderer-supabase',
  stripIncomingSignal: true,
});

/**
 * Crea un cliente Supabase con la configuración estándar de Electron.
 * @param url URL de la instancia Supabase
 * @param anonKey Clave anónima
 * @param storageKey Clave de localStorage para persistir sesión (opcional)
 */
export function createElectronSupabaseClient(
  url: string,
  anonKey: string,
  storageKey?: string,
): SupabaseClient | null {
  if (!url || !anonKey || !isValidUrl(url)) {
    return null;
  }

  return createClient(url, anonKey, {
    auth: {
      storage: localStorageAdapter,
      ...(storageKey ? { storageKey } : {}),
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
    global: {
      fetch: electronFetch,
    },
  });
}
