export function createSupabaseDiagnostics() {
  return {
    renderer: {
      source: 'renderer_env',
      url: 'https://renderer.supabase.co',
      projectRef: 'renderer',
      keyKind: 'unknown',
      configError: 'VITE_SUPABASE_ANON_KEY no tiene un formato de clave Supabase reconocido',
    },
    runtime: {
      source: 'runtime_env',
      url: 'https://lia-runtime.supabase.co',
      projectRef: 'lia-runtime',
      keyKind: 'jwt',
      configError: null,
    },
    effective: {
      source: 'runtime_env',
      url: 'https://lia-runtime.supabase.co',
      projectRef: 'lia-runtime',
      keyKind: 'jwt',
      configError: null,
    },
    usingRuntimeOverride: true,
  };
}
