import { createClient } from '@supabase/supabase-js';
import { SUPABASE } from '../config';

// Storage adapter using localStorage (Electron desktop)
const localStorageAdapter = {
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

// Validate URL before creating client
const isValidUrl = (url: string) => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

const supabaseUrl = isValidUrl(SUPABASE.URL) ? SUPABASE.URL : 'https://placeholder-project.supabase.co';
const supabaseKey = SUPABASE.ANON_KEY || 'placeholder-key';

if (!isValidUrl(SUPABASE.URL)) {
  console.warn('Supabase URL is missing or invalid. Check your .env file.');
}

// Custom fetch without automatic AbortSignal timeout (prevents "signal is aborted" in Electron)
const electronFetch: typeof globalThis.fetch = (input, init) => {
  const { signal: _signal, ...rest } = init || {};
  return globalThis.fetch(input, rest);
};

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    storage: localStorageAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
  global: {
    fetch: electronFetch,
  },
});

export const isSupabaseConfigured = () => {
  return SUPABASE.URL !== '' && SUPABASE.ANON_KEY !== '' && isValidUrl(SUPABASE.URL);
};
