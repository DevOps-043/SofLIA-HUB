import { isValidUrl } from '../supabase-factory';
import type { SupabaseConfigSnapshot, SupabaseConfigSource, SupabaseKeyKind } from './types';

function getSupabaseKeyKind(key: string): SupabaseKeyKind {
  if (!key) return 'unknown';
  if (key.startsWith('sb_publishable_')) return 'publishable';
  if (key.startsWith('eyJ') && key.split('.').length === 3) return 'jwt';
  return 'unknown';
}

export function getSupabaseProjectRef(url: string): string | null {
  const match = url.match(/^https:\/\/([^.]+)\.supabase\.co/i);
  return match?.[1] ?? null;
}

export function getSupabaseConfigErrorFor(url: string, anonKey: string): string | null {
  if (!url) return 'Falta VITE_SUPABASE_URL';
  if (!isValidUrl(url)) return 'VITE_SUPABASE_URL no es una URL valida';
  if (!anonKey) return 'Falta VITE_SUPABASE_ANON_KEY';
  if (getSupabaseKeyKind(anonKey) === 'unknown') {
    return 'VITE_SUPABASE_ANON_KEY no tiene un formato de clave Supabase reconocido';
  }
  return null;
}

export function buildSupabaseSnapshot(
  source: SupabaseConfigSource,
  url: string,
  anonKey: string,
): SupabaseConfigSnapshot {
  return {
    source,
    url,
    projectRef: getSupabaseProjectRef(url),
    keyKind: getSupabaseKeyKind(anonKey),
    configError: getSupabaseConfigErrorFor(url, anonKey),
  };
}
