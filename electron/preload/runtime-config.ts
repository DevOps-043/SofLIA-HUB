type SupabaseKeyKind = 'jwt' | 'publishable' | 'unknown';

function getSupabaseKeyKind(key: string): SupabaseKeyKind {
  if (!key) return 'unknown';
  if (key.startsWith('sb_publishable_')) return 'publishable';
  if (key.startsWith('eyJ') && key.split('.').length === 3) return 'jwt';
  return 'unknown';
}

function getSupabaseProjectRef(url: string): string | null {
  const match = url.match(/^https:\/\/([^.]+)\.supabase\.co/i);
  return match?.[1] ?? null;
}

export const runtimeConfig = Object.freeze({
  liaSupabase: Object.freeze({
    url: process.env.VITE_SUPABASE_URL || '',
    anonKey: process.env.VITE_SUPABASE_ANON_KEY || '',
    keyKind: getSupabaseKeyKind(process.env.VITE_SUPABASE_ANON_KEY || ''),
    projectRef: getSupabaseProjectRef(process.env.VITE_SUPABASE_URL || ''),
  }),
});
