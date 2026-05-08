import { SUPABASE } from '../../config';
import { buildSupabaseSnapshot } from './config-utils';
import { getRuntimeSupabaseConfig } from './runtime-config';
import type { ResolvedSupabaseConfig } from './types';

const PLACEHOLDER_SUPABASE_URL = 'https://placeholder-project.supabase.co';
const PLACEHOLDER_SUPABASE_KEY = 'placeholder-key';

export const rendererSupabaseConfig: ResolvedSupabaseConfig = {
  source: 'renderer_env',
  url: SUPABASE.URL,
  anonKey: SUPABASE.ANON_KEY,
  snapshot: buildSupabaseSnapshot('renderer_env', SUPABASE.URL, SUPABASE.ANON_KEY),
};

export const runtimeSupabaseConfig = getRuntimeSupabaseConfig();

export const effectiveSupabaseConfig: ResolvedSupabaseConfig =
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

export const usingRuntimeOverride =
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
