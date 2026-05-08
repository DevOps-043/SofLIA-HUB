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

export interface ResolvedSupabaseConfig {
  source: SupabaseConfigSource;
  url: string;
  anonKey: string;
  snapshot: SupabaseConfigSnapshot;
}
