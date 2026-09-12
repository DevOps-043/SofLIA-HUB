import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { safeStorage } from 'electron';
import { browserProfilePath, resolveStoreLocation } from './profile-scope';
import { flushPolicyFile, PolicyRecoveryUnsupportedError, preparePolicyRecovery, readPolicyFile, serializePolicyFile, writePolicyFile, type PolicyFileCodec } from './policy-file-recovery';
import { BROWSER_SHORTCUT_LIMITS, validateBrowserShortcut, validateBrowserShortcutRequest, type BrowserShortcutLibrary, type BrowserShortcutRequest } from '../../src/shared/browser-agent-shortcuts';

const MAX_BYTES = 2 * 1024 * 1024;
type ShortcutFile = BrowserShortcutLibrary & { version: 1; scope: string };
function failure(): Error { return new Error('No se pudo leer o guardar los atajos cifrados. Se conserva el archivo anterior.'); }
function secure(): void {
  if (!safeStorage.isEncryptionAvailable() || (process.platform === 'linux' && safeStorage.getSelectedStorageBackend() === 'basic_text')) throw failure();
}
const codec: PolicyFileCodec = {
  decode(content) { secure(); if (content.length > MAX_BYTES) throw new PolicyRecoveryUnsupportedError(); return JSON.parse(safeStorage.decryptString(content)); },
  encode(value) { secure(); const content = safeStorage.encryptString(JSON.stringify(value)); if (content.length > MAX_BYTES) throw failure(); return content; },
};
function validate(destination: string, raw: unknown): ShortcutFile {
  const file = raw as ShortcutFile;
  if (file && typeof file === 'object' && 'scope' in file && file.scope !== destination) throw new PolicyRecoveryUnsupportedError();
  if (!file || file.version !== 1 || file.scope !== destination || Object.keys(file).sort().join(',') !== 'entries,revision,scope,version'
    || !Number.isSafeInteger(file.revision) || file.revision < 0 || !Array.isArray(file.entries) || file.entries.length > BROWSER_SHORTCUT_LIMITS.count) throw failure();
  const entries = file.entries.map(entry => validateBrowserShortcut(entry));
  if (new Set(entries.map(entry => entry.id)).size !== entries.length) throw failure();
  return { version: 1, scope: destination, revision: file.revision, entries };
}

/** Biblioteca cifrada v1; lecturas, guardados y recuperación comparten la cola por archivo. */
export class BrowserAgentShortcutStore {
  constructor(private readonly location: string | (() => string) = () => browserProfilePath('agent-shortcuts.v1.bin')) {}
  private get destination() { return path.resolve(resolveStoreLocation(this.location)); }
  async flush(): Promise<void> { await flushPolicyFile(this.destination); }

  async run(raw: BrowserShortcutRequest, guard: () => void): Promise<BrowserShortcutLibrary> {
    const input = validateBrowserShortcutRequest(raw); const destination = this.destination; guard(); secure();
    return serializePolicyFile(destination, async () => {
      try {
        guard();
        const check = (value: unknown) => validate(destination, value);
        const library = await readPolicyFile<ShortcutFile>(destination, check, () => ({ version: 1, scope: destination, revision: 0, entries: [] }), codec);
        guard();
        if (input.action === 'list') return { revision: library.revision, entries: library.entries };
        if (input.revision !== library.revision) throw new Error('Los atajos cambiaron. Actualiza la lista antes de guardar.');
        if (input.action === 'remove') {
          if (!library.entries.some(entry => entry.id === input.id)) throw new Error('El atajo ya no existe.');
          library.entries = library.entries.filter(entry => entry.id !== input.id);
        } else {
          const entry = input.entry; const index = library.entries.findIndex(item => item.id === entry.id);
          if (entry.id && index === -1) throw new Error('El atajo ya no existe.');
          if (!entry.id && library.entries.length >= BROWSER_SHORTCUT_LIMITS.count) throw new Error('Se alcanzó el límite de 50 atajos.');
          const saved = { ...entry, id: entry.id || randomUUID() };
          if (index === -1) library.entries.push(saved); else library.entries[index] = saved;
        }
        library.revision++;
        await writePolicyFile(destination, library, check, guard, input.action === 'remove', codec);
        return { revision: library.revision, entries: library.entries };
      } catch (error) {
        if (error instanceof Error && ['Los atajos cambiaron. Actualiza la lista antes de guardar.', 'El atajo ya no existe.', 'Se alcanzó el límite de 50 atajos.'].includes(error.message)) throw error;
        throw failure();
      }
    });
  }

  async prepareRecovery(guard: () => void) {
    const destination = this.destination; await flushPolicyFile(destination); guard(); secure();
    return preparePolicyRecovery<ShortcutFile>(destination, raw => validate(destination, raw), library => ({
      count: library.entries.length,
      // Nuevos IDs/recibo invalidan editores previos, sin ejecutar ni conceder permisos.
      value: { ...library, revision: Math.max(library.revision + 1, Date.now()), entries: library.entries.map(entry => ({ ...entry, id: randomUUID() })) },
    }), guard, codec);
  }
}
