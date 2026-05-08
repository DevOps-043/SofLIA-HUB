import { buildSupabaseSnapshot } from './config-utils';
import type { ResolvedSupabaseConfig, SupabaseKeyKind } from './types';

declare global {
  interface Window {
    appRuntime?: {
      liaSupabase?: {
        url?: string;
        anonKey?: string;
        keyKind?: SupabaseKeyKind;
        projectRef?: string | null;
      };
    };
  }
}

export function getRuntimeSupabaseConfig(): ResolvedSupabaseConfig | null {
  if (typeof window === 'undefined') return null;

  const runtime = window.appRuntime?.liaSupabase;
  if (!runtime) return null;

  const url = String(runtime.url || '');
  const anonKey = String(runtime.anonKey || '');
  return {
    source: 'runtime_env',
    url,
    anonKey,
    snapshot: buildSupabaseSnapshot('runtime_env', url, anonKey),
  };
}
