const RUNTIME_ENV_KEYS = new Set(['VITE_DEV_SERVER_URL', 'VITE_PUBLIC']);
const NATIVE_AI_KEYS = new Set(['VITE_OPENAI_API_KEY', 'VITE_GEMINI_API_KEY']);

export function createPublicEnvDefines(env: Record<string, string>): Record<string, string> {
  // Vite incorpora estas propiedades al entorno del renderer tanto al servir como al compilar.
  return Object.fromEntries(Object.entries(env)
    .filter(([key]) => key.startsWith('VITE_') && !NATIVE_AI_KEYS.has(key))
    .map(([key, value]) => [`import.meta.env.${key}`, JSON.stringify(value)]));
}

export function createPreloadEnvDefines(env: Record<string, string>): Record<string, string> {
  return createMainProcessEnvDefines(Object.fromEntries(Object.entries(env).filter(([key]) => !NATIVE_AI_KEYS.has(key))));
}

export function createMainProcessEnvDefines(env: Record<string, string>): Record<string, string> {
  const defines: Record<string, string> = {};

  for (const key of Object.keys(env)) {
    if (RUNTIME_ENV_KEYS.has(key)) continue;
    defines[`process.env.${key}`] = JSON.stringify(env[key]);
  }

  return defines;
}
