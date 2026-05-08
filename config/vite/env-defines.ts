const RUNTIME_ENV_KEYS = new Set(['VITE_DEV_SERVER_URL', 'VITE_PUBLIC']);

export function createMainProcessEnvDefines(env: Record<string, string>): Record<string, string> {
  const defines: Record<string, string> = {};

  for (const key of Object.keys(env)) {
    if (RUNTIME_ENV_KEYS.has(key)) continue;
    defines[`process.env.${key}`] = JSON.stringify(env[key]);
  }

  return defines;
}
