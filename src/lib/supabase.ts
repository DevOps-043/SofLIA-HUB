import { SUPABASE } from '../config';
import { createElectronSupabaseClient, isValidUrl } from './supabase-factory';

const PLACEHOLDER_SUPABASE_URL = 'https://placeholder-project.supabase.co';
const PLACEHOLDER_SUPABASE_KEY = 'placeholder-key';

export type SupabaseKeyKind = 'jwt' | 'publishable' | 'unknown';
export type SupabaseConfigSource = 'renderer_env' | 'runtime_env' | 'placeholder';

export interface SupabaseConfigSnapshot {
  source: SupabaseConfigSource;
  url: string;
  projectRef: string | null;
  keyKind: SupabaseKeyKind;
  configError: string | null;
}

export interface SupabaseConfigDiagnostics {
  renderer: SupabaseConfigSnapshot;
  runtime: SupabaseConfigSnapshot | null;
  effective: SupabaseConfigSnapshot;
  usingRuntimeOverride: boolean;
}

interface ResolvedSupabaseConfig {
  source: SupabaseConfigSource;
  url: string;
  anonKey: string;
  snapshot: SupabaseConfigSnapshot;
}

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

function getSupabaseConfigErrorFor(url: string, anonKey: string): string | null {
  if (!url) {
    return 'Falta VITE_SUPABASE_URL';
  }

  if (!isValidUrl(url)) {
    return 'VITE_SUPABASE_URL no es una URL valida';
  }

  if (!anonKey) {
    return 'Falta VITE_SUPABASE_ANON_KEY';
  }

  if (getSupabaseKeyKind(anonKey) === 'unknown') {
    return 'VITE_SUPABASE_ANON_KEY no tiene un formato de clave Supabase reconocido';
  }

  return null;
}

function buildSupabaseSnapshot(source: SupabaseConfigSource, url: string, anonKey: string): SupabaseConfigSnapshot {
  return {
    source,
    url,
    projectRef: getSupabaseProjectRef(url),
    keyKind: getSupabaseKeyKind(anonKey),
    configError: getSupabaseConfigErrorFor(url, anonKey),
  };
}

function getRuntimeSupabaseConfig(): ResolvedSupabaseConfig | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const runtime = window.appRuntime?.liaSupabase;
  if (!runtime) {
    return null;
  }

  const url = String(runtime.url || '');
  const anonKey = String(runtime.anonKey || '');
  return {
    source: 'runtime_env',
    url,
    anonKey,
    snapshot: buildSupabaseSnapshot('runtime_env', url, anonKey),
  };
}

const rendererSupabaseConfig: ResolvedSupabaseConfig = {
  source: 'renderer_env',
  url: SUPABASE.URL,
  anonKey: SUPABASE.ANON_KEY,
  snapshot: buildSupabaseSnapshot('renderer_env', SUPABASE.URL, SUPABASE.ANON_KEY),
};

const runtimeSupabaseConfig = getRuntimeSupabaseConfig();
const effectiveSupabaseConfig: ResolvedSupabaseConfig =
  runtimeSupabaseConfig && runtimeSupabaseConfig.snapshot.configError === null
    ? runtimeSupabaseConfig
    : rendererSupabaseConfig.snapshot.configError === null
    ? rendererSupabaseConfig
    : {
        source: 'placeholder',
        url: PLACEHOLDER_SUPABASE_URL,
        anonKey: PLACEHOLDER_SUPABASE_KEY,
        snapshot: buildSupabaseSnapshot('placeholder', PLACEHOLDER_SUPABASE_URL, PLACEHOLDER_SUPABASE_KEY),
      };

const usingRuntimeOverride =
  effectiveSupabaseConfig.source === 'runtime_env' &&
  (rendererSupabaseConfig.url !== effectiveSupabaseConfig.url ||
    rendererSupabaseConfig.anonKey !== effectiveSupabaseConfig.anonKey);

if (usingRuntimeOverride) {
  console.info(
    `[Lia] Usando configuracion runtime de Electron para Supabase (${effectiveSupabaseConfig.snapshot.projectRef || 'sin-proyecto'})`,
  );
} else if (effectiveSupabaseConfig.snapshot.configError) {
  console.warn(`Lia Supabase no esta configurado correctamente: ${effectiveSupabaseConfig.snapshot.configError}`);
}

export function getSupabaseConfigError(): string | null {
  return effectiveSupabaseConfig.snapshot.configError;
}

export function getSupabaseConfigDiagnostics(): SupabaseConfigDiagnostics {
  return {
    renderer: rendererSupabaseConfig.snapshot,
    runtime: runtimeSupabaseConfig?.snapshot ?? null,
    effective: effectiveSupabaseConfig.snapshot,
    usingRuntimeOverride,
  };
}

export const supabase = createElectronSupabaseClient(
  effectiveSupabaseConfig.url,
  effectiveSupabaseConfig.anonKey,
)!;

export const isSupabaseConfigured = () => {
  return getSupabaseConfigError() === null;
};
