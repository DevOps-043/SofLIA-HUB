import { app, safeStorage } from 'electron';
import * as dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import type { SofliaLearningConfig, SofliaLearningKeyKind } from './types';

const SERVICE_NAME = 'SofLIA Learning';
const SECURE_CONFIG_FILE = 'soflia-learning-config.json';
const SECURE_CONFIG_VERSION = 1;

let envLoaded = false;

interface SofliaLearningSecureConfigFile {
  version: number;
  supabaseUrl: string;
  keyKind: SofliaLearningKeyKind;
  encryptedKey: string;
  updatedAt: string;
}

export interface SaveSofliaLearningSecureConfigInput {
  url: string;
  key: string;
  keyKind?: SofliaLearningKeyKind;
}

function readEnvValue(env: NodeJS.ProcessEnv, names: string[]): string {
  for (const name of names) {
    const value = env[name]?.trim();
    if (value) {
      return value;
    }
  }
  return '';
}

function getAppPathSafe(): string | null {
  try {
    const maybeApp = app as unknown as { getAppPath?: () => string };
    return typeof maybeApp.getAppPath === 'function' ? maybeApp.getAppPath() : null;
  } catch {
    return null;
  }
}

function getUserDataPathSafe(): string | null {
  try {
    const maybeApp = app as unknown as { getPath?: (name: string) => string };
    return typeof maybeApp.getPath === 'function' ? maybeApp.getPath('userData') : null;
  } catch {
    return null;
  }
}

export function ensureSofliaLearningEnvLoaded(): void {
  if (envLoaded) {
    return;
  }

  const appPath = getAppPathSafe();
  if (appPath) {
    const envPath = path.join(appPath, '.env');
    if (fs.existsSync(envPath)) {
      dotenv.config({ path: envPath });
    }
  }

  envLoaded = true;
}

export function readSofliaLearningConfigFromEnv(env: NodeJS.ProcessEnv = process.env): SofliaLearningConfig {
  const url = readEnvValue(env, [
    'SOFLIA_LEARNING_SUPABASE_URL',
    'VITE_SOFLIA_LEARNING_SUPABASE_URL',
  ]);
  const anonKey = readEnvValue(env, [
    'SOFLIA_LEARNING_SUPABASE_ANON_KEY',
    'VITE_SOFLIA_LEARNING_SUPABASE_ANON_KEY',
  ]);
  const serviceRoleKey = readEnvValue(env, [
    'SOFLIA_LEARNING_SUPABASE_SERVICE_ROLE_KEY',
    'SOFLIA_LEARNING_SERVICE_ROLE_KEY',
  ]);

  const allowDesktopServiceRole = env.SOFLIA_LEARNING_ALLOW_DESKTOP_SERVICE_ROLE === 'true';
  let key = anonKey;
  let keyKind: SofliaLearningKeyKind | null = anonKey ? 'anon' : null;

  if (serviceRoleKey && allowDesktopServiceRole) {
    key = serviceRoleKey;
    keyKind = 'service_role';
  }

  if (!url || !key) {
    const missing = [
      !url ? 'SOFLIA_LEARNING_SUPABASE_URL' : null,
      !key ? 'SOFLIA_LEARNING_SUPABASE_ANON_KEY' : null,
    ].filter(Boolean).join(', ');
    return {
      configured: false,
      source: 'missing',
      url: '',
      key: '',
      keyKind: null,
      projectRef: null,
      error: `${SERVICE_NAME} no esta configurado. Faltan: ${missing}.`,
    };
  }

  return {
    configured: true,
    source: 'env',
    url,
    key,
    keyKind,
    projectRef: getSupabaseProjectRef(url),
  };
}

export function readSofliaLearningConfig(env: NodeJS.ProcessEnv = process.env): SofliaLearningConfig {
  ensureSofliaLearningEnvLoaded();
  const envConfig = readSofliaLearningConfigFromEnv(env);
  if (envConfig.configured) {
    return envConfig;
  }

  return readSofliaLearningSecureConfig() || envConfig;
}

export function getSofliaLearningSecureConfigPath(): string | null {
  const userDataPath = getUserDataPathSafe();
  return userDataPath ? path.join(userDataPath, SECURE_CONFIG_FILE) : null;
}

export function readSofliaLearningSecureConfig(): SofliaLearningConfig | null {
  const configPath = getSofliaLearningSecureConfigPath();
  if (!configPath || !fs.existsSync(configPath)) {
    return null;
  }

  if (!isSafeStorageAvailable()) {
    return {
      configured: false,
      source: 'secure_local',
      url: '',
      key: '',
      keyKind: null,
      projectRef: null,
      error: `${SERVICE_NAME} tiene config local, pero safeStorage no esta disponible.`,
    };
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(configPath, 'utf-8')) as Partial<SofliaLearningSecureConfigFile>;
    if (parsed.version !== SECURE_CONFIG_VERSION || !parsed.supabaseUrl || !parsed.encryptedKey) {
      return {
        configured: false,
        source: 'secure_local',
        url: '',
        key: '',
        keyKind: null,
        projectRef: null,
        error: `${SERVICE_NAME} tiene config local invalida.`,
      };
    }

    const key = safeStorage.decryptString(Buffer.from(parsed.encryptedKey, 'base64')).trim();
    if (!key) {
      return {
        configured: false,
        source: 'secure_local',
        url: '',
        key: '',
        keyKind: null,
        projectRef: null,
        error: `${SERVICE_NAME} tiene una key local vacia.`,
      };
    }

    return {
      configured: true,
      source: 'secure_local',
      url: parsed.supabaseUrl,
      key,
      keyKind: parsed.keyKind || 'anon',
      projectRef: getSupabaseProjectRef(parsed.supabaseUrl),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      configured: false,
      source: 'secure_local',
      url: '',
      key: '',
      keyKind: null,
      projectRef: null,
      error: `${SERVICE_NAME} no pudo leer config local: ${message}`,
    };
  }
}

export function saveSofliaLearningSecureConfig(
  input: SaveSofliaLearningSecureConfigInput,
): { success: true; path: string } | { success: false; error: string } {
  const configPath = getSofliaLearningSecureConfigPath();
  if (!configPath) {
    return { success: false, error: 'No se pudo resolver userData para SofLIA Learning.' };
  }
  if (!isSafeStorageAvailable()) {
    return { success: false, error: 'safeStorage no esta disponible para SofLIA Learning.' };
  }

  const url = input.url.trim();
  const key = input.key.trim();
  if (!url || !key) {
    return { success: false, error: 'URL y key de SofLIA Learning son requeridas.' };
  }

  const encryptedKey = safeStorage.encryptString(key).toString('base64');
  const payload: SofliaLearningSecureConfigFile = {
    version: SECURE_CONFIG_VERSION,
    supabaseUrl: url,
    keyKind: input.keyKind || 'anon',
    encryptedKey,
    updatedAt: new Date().toISOString(),
  };

  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, JSON.stringify(payload, null, 2));
  return { success: true, path: configPath };
}

function isSafeStorageAvailable(): boolean {
  try {
    const maybeSafeStorage = safeStorage as unknown as {
      isEncryptionAvailable?: () => boolean;
      encryptString?: (value: string) => Buffer;
      decryptString?: (buffer: Buffer) => string;
    };
    return Boolean(
      maybeSafeStorage &&
      typeof maybeSafeStorage.encryptString === 'function' &&
      typeof maybeSafeStorage.decryptString === 'function' &&
      (typeof maybeSafeStorage.isEncryptionAvailable !== 'function' || maybeSafeStorage.isEncryptionAvailable()),
    );
  } catch {
    return false;
  }
}

export function getSupabaseProjectRef(url: string): string | null {
  try {
    const hostname = new URL(url).hostname;
    const suffix = '.supabase.co';
    return hostname.endsWith(suffix) ? hostname.slice(0, -suffix.length) : null;
  } catch {
    return null;
  }
}
