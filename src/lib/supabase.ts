import { createElectronSupabaseClient } from './supabase-factory';
import {
  effectiveSupabaseConfig,
  rendererSupabaseConfig,
  runtimeSupabaseConfig,
  usingRuntimeOverride,
} from './supabase/effective-config';
import type { SupabaseConfigDiagnostics } from './supabase/types';

export type {
  SupabaseConfigDiagnostics,
  SupabaseConfigSnapshot,
  SupabaseConfigSource,
  SupabaseKeyKind,
} from './supabase/types';
export { getSupabaseProjectRef } from './supabase/config-utils';

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

export const isSupabaseConfigured = () => getSupabaseConfigError() === null;
