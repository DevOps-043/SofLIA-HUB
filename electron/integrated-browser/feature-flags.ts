export const BROWSER_CAPABILITY_KEYS = [
  'downloads',
  'pageTools',
  'sessionRestore',
  'advancedTabs',
  'profiles',
  'mainBookmarks',
  'advancedHistory',
  'credentialHealth',
  'privacyProtection',
  'agentGovernance',
  'encryptedSync',
  'enterpriseControls',
] as const;

export type BrowserCapabilityKey = (typeof BROWSER_CAPABILITY_KEYS)[number];
export type BrowserCapabilityFlags = Readonly<Record<BrowserCapabilityKey, boolean>>;

const ENV_BY_CAPABILITY: Record<BrowserCapabilityKey, string> = {
  downloads: 'BROWSER_DOWNLOADS_ENABLED',
  pageTools: 'BROWSER_PAGE_TOOLS_ENABLED',
  sessionRestore: 'BROWSER_SESSION_RESTORE_ENABLED',
  advancedTabs: 'BROWSER_ADVANCED_TABS_ENABLED',
  profiles: 'BROWSER_PROFILES_ENABLED',
  mainBookmarks: 'BROWSER_MAIN_BOOKMARKS_ENABLED',
  advancedHistory: 'BROWSER_ADVANCED_HISTORY_ENABLED',
  credentialHealth: 'BROWSER_CREDENTIAL_HEALTH_ENABLED',
  privacyProtection: 'BROWSER_PRIVACY_PROTECTION_ENABLED',
  agentGovernance: 'BROWSER_AGENT_GOVERNANCE_ENABLED',
  encryptedSync: 'BROWSER_ENCRYPTED_SYNC_ENABLED',
  enterpriseControls: 'BROWSER_ENTERPRISE_CONTROLS_ENABLED',
};

/**
 * P0 se activa por defecto porque sólo amplía controles locales del navegador.
 * Restauración, privacidad, agente y empresa permanecen apagados por defecto.
 * Perfiles, historial avanzado y sync reservan configuración para fases abiertas;
 * sus valores no constituyen un rollback de los stores locales ya migrados.
 */
export const DEFAULT_BROWSER_CAPABILITY_FLAGS: BrowserCapabilityFlags = Object.freeze({
  downloads: true,
  pageTools: true,
  sessionRestore: false,
  advancedTabs: true,
  profiles: false,
  mainBookmarks: true,
  advancedHistory: false,
  credentialHealth: true,
  privacyProtection: false,
  agentGovernance: false,
  encryptedSync: false,
  enterpriseControls: false,
});

export function readBrowserCapabilityFlags(
  env: Readonly<Record<string, string | undefined>> = process.env,
): BrowserCapabilityFlags {
  return Object.freeze(Object.fromEntries(BROWSER_CAPABILITY_KEYS.map((key) => [
    key,
    parseFlag(env[ENV_BY_CAPABILITY[key]], DEFAULT_BROWSER_CAPABILITY_FLAGS[key]),
  ])) as unknown as BrowserCapabilityFlags);
}

function parseFlag(raw: string | undefined, fallback: boolean): boolean {
  if (raw === undefined || raw.trim() === '') return fallback;
  const normalized = raw.trim().toLowerCase();
  if (normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on') return true;
  if (normalized === '0' || normalized === 'false' || normalized === 'no' || normalized === 'off') return false;
  return fallback;
}
