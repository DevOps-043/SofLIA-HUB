import { SUPABASE } from '../config';
import { createElectronSupabaseClient, isValidUrl } from './supabase-factory';

const supabaseUrl = isValidUrl(SUPABASE.URL) ? SUPABASE.URL : 'https://placeholder-project.supabase.co';
const supabaseKey = SUPABASE.ANON_KEY || 'placeholder-key';

function getSupabaseKeyKind(key: string): 'jwt' | 'publishable' | 'unknown' {
  if (!key) return 'unknown';
  if (key.startsWith('sb_publishable_')) return 'publishable';
  if (key.startsWith('eyJ') && key.split('.').length === 3) return 'jwt';
  return 'unknown';
}

export function getSupabaseProjectRef(url: string): string | null {
  const match = url.match(/^https:\/\/([^.]+)\.supabase\.co/i);
  return match?.[1] ?? null;
}

export function getSupabaseConfigError(): string | null {
  if (!SUPABASE.URL) {
    return 'Falta VITE_SUPABASE_URL';
  }

  if (!isValidUrl(SUPABASE.URL)) {
    return 'VITE_SUPABASE_URL no es una URL valida';
  }

  if (!SUPABASE.ANON_KEY) {
    return 'Falta VITE_SUPABASE_ANON_KEY';
  }

  if (getSupabaseKeyKind(SUPABASE.ANON_KEY) === 'unknown') {
    return 'VITE_SUPABASE_ANON_KEY no tiene un formato de clave Supabase reconocido';
  }

  return null;
}

if (!isValidUrl(SUPABASE.URL)) {
  console.warn('Supabase URL is missing or invalid. Check your .env file.');
}

export const supabase = createElectronSupabaseClient(supabaseUrl, supabaseKey)!;

export const isSupabaseConfigured = () => {
  return getSupabaseConfigError() === null;
};
