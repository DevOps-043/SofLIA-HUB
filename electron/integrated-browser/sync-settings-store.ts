import path from 'node:path';
import { safeStorage } from 'electron';
import type { BrowserSyncCategory } from './platform-types';
import { BrowserSyncError, assertSyncUuid } from './sync-remote';
import { flushPolicyFile, PolicyRecoveryUnsupportedError, preparePolicyRecovery, readPolicyFile, serializePolicyFile, writePolicyFile, type PolicyFileCodec } from './policy-file-recovery';
import { assertSyncRecoveryAvailable } from './sync-recovery-guard';

export interface BrowserSyncSettings {
  version: 1;
  ownerId: string | null;
  origin: string | null;
  categories: BrowserSyncCategory[];
  lastSyncedAt: string | null;
}
export function normalizeSyncCategories(raw: unknown): BrowserSyncCategory[] {
  const allowed: BrowserSyncCategory[] = ['bookmarks', 'groups', 'tabs', 'settings'];
  if (!Array.isArray(raw) || raw.length > 4 || raw.some((value) => !allowed.includes(value)) || new Set(raw).size !== raw.length) throw new BrowserSyncError('Selecciona categorías válidas, sin duplicados.');
  return allowed.filter((category) => raw.includes(category));
}
export function validateSyncSettings(raw: unknown): BrowserSyncSettings {
  const value = raw as BrowserSyncSettings;
  if (!value || Object.keys(value).sort().join(',') !== 'categories,lastSyncedAt,origin,ownerId,version' || value.version !== 1) throw new Error();
  if (value.ownerId !== null) assertSyncUuid(value.ownerId);
  if (value.origin !== null && (typeof value.origin !== 'string' || !/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(value.origin))) throw new Error();
  const categories = normalizeSyncCategories(value.categories);
  if ((value.ownerId === null) !== (value.origin === null) || (categories.length && !value.ownerId)) throw new Error();
  if (value.lastSyncedAt !== null && (typeof value.lastSyncedAt !== 'string' || value.lastSyncedAt.length > 40 || !Number.isFinite(Date.parse(value.lastSyncedAt)))) throw new Error();
  return { ...value, categories };
}
function secure() {
  if (!safeStorage.isEncryptionAvailable() || (process.platform === 'linux' && safeStorage.getSelectedStorageBackend() === 'basic_text')) throw new BrowserSyncError('El almacén seguro del SO no está disponible.');
}
function failure() { return new BrowserSyncError('No se pudo leer o guardar la configuración cifrada de sincronización. Se conserva el archivo anterior.'); }

/** Preferencias locales protegidas; recuperar nunca activa transferencia. */
export class BrowserSyncSettingsStore {
  constructor(private readonly destination: string) {}
  private codec(): PolicyFileCodec {
    const scope = path.basename(path.dirname(this.destination));
    return {
      decode: content => {
        secure(); if (content.length > 8192) throw new PolicyRecoveryUnsupportedError();
        const outer = JSON.parse(content.toString('utf8'));
        if (outer && typeof outer === 'object' && 'version' in outer && outer.version !== 1) throw new PolicyRecoveryUnsupportedError();
        if (!outer || Object.keys(outer).sort().join(',') !== 'protectedData,version' || typeof outer.protectedData !== 'string') throw failure();
        const bytes = Buffer.from(outer.protectedData, 'base64');
        if (!bytes.length || bytes.toString('base64') !== outer.protectedData) throw failure();
        const decoded = JSON.parse(safeStorage.decryptString(bytes));
        if (decoded && typeof decoded === 'object' && 'scope' in decoded && decoded.scope !== scope) throw new PolicyRecoveryUnsupportedError();
        if (!decoded || Object.keys(decoded).sort().join(',') !== 'scope,settings' || decoded.scope !== scope) throw failure();
        return decoded.settings;
      },
      encode: settings => {
        secure();
        const protectedData = safeStorage.encryptString(JSON.stringify({ scope, settings })).toString('base64');
        const content = Buffer.from(JSON.stringify({ version: 1, protectedData }));
        if (content.length > 8192) throw failure(); return content;
      },
    };
  }
  read(): Promise<BrowserSyncSettings> {
    return serializePolicyFile(this.destination, async () => {
      try {
        secure();
        assertSyncRecoveryAvailable(path.dirname(this.destination));
        const result = await readPolicyFile<BrowserSyncSettings>(this.destination, validateSyncSettings, () => ({ version: 1, ownerId: null, origin: null, categories: [], lastSyncedAt: null }), this.codec());
        assertSyncRecoveryAvailable(path.dirname(this.destination)); return result;
      } catch { throw failure(); }
    });
  }
  write(raw: BrowserSyncSettings, guard: () => void): Promise<void> {
    const value = validateSyncSettings(raw);
    return serializePolicyFile(this.destination, async () => {
      const current = () => { guard(); assertSyncRecoveryAvailable(path.dirname(this.destination)); };
      try { secure(); current(); await writePolicyFile(this.destination, value, validateSyncSettings, current, !value.categories.length, this.codec()); }
      catch { throw failure(); }
    });
  }
  async prepareRecovery(guard: () => void) {
    await flushPolicyFile(this.destination); guard(); secure();
    const current = () => { guard(); assertSyncRecoveryAvailable(path.dirname(this.destination)); };
    current(); return preparePolicyRecovery(this.destination, validateSyncSettings, settings => ({
      count: 1, value: { ...settings, categories: [], lastSyncedAt: null },
    }), current, this.codec());
  }
}
