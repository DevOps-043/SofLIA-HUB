import { safeStorage } from 'electron';
import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { browserProfilePath, resolveStoreLocation } from './profile-scope';
import type { BrowserCredentialHealth, BrowserCredentialMetadata, BrowserCredentialSaveInput } from './types';
import { BrowserCredentialError } from './credential-errors';
import { assertCredentialSecureStorage, MAX_CREDENTIAL_VAULT_FILE_BYTES, openCredentialVault, sealCredentialVault } from './credential-vault-format';

type StoredCredential = BrowserCredentialMetadata & { passwordEncrypted: string };
type VaultFile = { version: 1; credentials: StoredCredential[]; autosaveEnabled?: boolean };

export interface BrowserCredentialTransferEntry {
  origin: string;
  username: string;
  password: string;
}

export interface BrowserCredentialImportSummary {
  total: number;
  newCount: number;
  conflictCount: number;
  duplicateCount: number;
  invalidCount: number;
}

export interface PreparedCredentialImport {
  summary: Readonly<BrowserCredentialImportSummary>;
  commit(mode: 'skip' | 'update', assertCurrent?: () => void): Promise<{ imported: number; updated: number; skipped: number }>;
}

const MAX_USERNAME_LENGTH = 320;
const MAX_PASSWORD_LENGTH = 4_096;
const MAX_CREDENTIALS = 500;
const SAVE_REVIEW_TIMEOUT_MS = 5 * 60_000;
export const MAX_CREDENTIAL_TRANSFER_BYTES = 5 * 1024 * 1024;
const fileQueues = new Map<string, Promise<void>>();
class UnsupportedCredentialVersion extends BrowserCredentialError {}

export interface PreparedCredentialSave {
  readonly origin: string;
  readonly username: string;
  readonly updating: boolean;
  readonly unchanged: boolean;
  commit(assertCurrent?: () => void): Promise<BrowserCredentialMetadata>;
}

export class BrowserCredentialVault {

  /** La boveda pertenece al perfil del usuario activo (ver `profile-scope`). */
  constructor(private readonly location: string | (() => string) = () => browserProfilePath('credentials.json')) {}

  async flush(): Promise<void> {
    await fileQueues.get(this.filePath);
  }

  private get filePath(): string {
    return path.resolve(resolveStoreLocation(this.location));
  }

  /** Recuperación revisada: nunca reemplaza una bóveda válida o de versión futura. */
  async prepareRecovery(): Promise<{ count: number; commit: (guard: () => void) => Promise<number> }> {
    const destination = this.filePath;
    this.assertSecureStorage();
    const prepared = await this.enqueue(destination, async () => {
      const original = await this.recoveryPrincipal(destination);
      const backup = await this.readFile(`${destination}.bak`, destination);
      if (!backup || backup.legacy) throw new BrowserCredentialError('No hay un respaldo cifrado compatible para este perfil.');
      this.validateRecoverySecrets(backup.vault);
      return { original, count: backup.vault.credentials.length, revision: vaultRevision(backup.vault),
        encrypted: sealCredentialVault(JSON.stringify({ ...backup.vault, autosaveEnabled: false }), vaultScope(destination)) };
    });
    const expiresAt = Date.now() + SAVE_REVIEW_TIMEOUT_MS;
    let consumed = false;
    return { count: prepared.count, commit: async (guard) => {
      if (consumed) throw new BrowserCredentialError('La revisión de recuperación ya se utilizó.');
      consumed = true;
      const assertCurrent = () => {
        guard(); this.assertSecureStorage();
        if (this.filePath !== destination || Date.now() >= expiresAt) throw new BrowserCredentialError('El perfil cambió o la revisión de recuperación venció.');
      };
      return this.enqueue(destination, async () => {
        assertCurrent();
        const original = await this.recoveryPrincipal(destination); assertCurrent();
        if (original !== prepared.original) throw new BrowserCredentialError('La bóveda cambió. No se reemplazó el archivo existente.');
        const backup = await this.readFile(`${destination}.bak`, destination); assertCurrent();
        if (!backup || backup.legacy || vaultRevision(backup.vault) !== prepared.revision) throw new BrowserCredentialError('El respaldo cambió. Revisa la recuperación de nuevo.');
        const temporary = `${destination}.${randomUUID()}.tmp`;
        try {
          const file = await fs.open(temporary, 'wx', 0o600);
          try { await file.writeFile(prepared.encrypted, 'utf8'); await file.sync(); }
          finally { await file.close(); }
          assertCurrent();
          if (prepared.original !== null) {
            // El archivo dañado puede contener metadata antigua: la copia de
            // recuperación también se protege con el SO, sin publicarla por IPC.
            const existingCopies = (await fs.readdir(path.dirname(destination))).filter((name) => name.startsWith(`${path.basename(destination)}.corrupt-`));
            if (existingCopies.length >= 5) throw new BrowserCredentialError('Ya existen cinco copias de recuperación. Conserva o retira las antiguas de forma explícita antes de continuar.');
            assertCurrent();
            const archive = `${destination}.corrupt-${randomUUID()}`;
            const protectedOriginal = safeStorage.encryptString(JSON.stringify({
              scope: vaultScope(destination), original: prepared.original,
            })).toString('base64');
            const copy = await fs.open(archive, 'wx', 0o600);
            try { await copy.writeFile(JSON.stringify({ version: 1, protectedOriginal }), 'utf8'); await copy.sync(); }
            finally { await copy.close(); }
            assertCurrent();
            if (await this.recoveryPrincipal(destination) !== prepared.original) throw new BrowserCredentialError('La bóveda cambió. Se conserva la copia protegida, sin reemplazar el principal.');
            assertCurrent();
            // La cola serializa escritores de esta aplicación. No es un bloqueo
            // multiproceso; la copia conserva los bytes revisados antes del rename.
            await fs.rename(temporary, destination);
            return prepared.count;
          }
          // El enlace publica el archivo completo y falla si apareció otro
          // principal. No usar rename: podría reemplazarlo en esa carrera.
          await fs.link(temporary, destination);
          return prepared.count;
        } finally { await fs.unlink(temporary).catch(() => undefined); }
      });
    } };
  }

  private async fileExists(filename: string): Promise<boolean> {
    try { await fs.lstat(filename); return true; }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
      throw new BrowserCredentialError('No se pudo comprobar el archivo de la bóveda.');
    }
  }

  private async recoveryPrincipal(destination: string): Promise<string | null> {
    if (!await this.fileExists(destination)) return null;
    const stat = await fs.lstat(destination);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > MAX_CREDENTIAL_VAULT_FILE_BYTES) throw new BrowserCredentialError('El principal no es un archivo regular de tamaño permitido.');
    const file = await fs.open(destination, 'r');
    let bytes: Buffer;
    try {
      const opened = await file.stat();
      if (opened.ino !== stat.ino || opened.size !== stat.size) throw new BrowserCredentialError('La bóveda cambió durante la revisión.');
      const buffer = Buffer.alloc(stat.size + 1); let length = 0;
      while (length < buffer.length) {
        const { bytesRead } = await file.read(buffer, length, buffer.length - length, null);
        if (!bytesRead) break;
        length += bytesRead;
      }
      if (length !== stat.size || (await file.stat()).mtimeMs !== opened.mtimeMs) throw new BrowserCredentialError('La bóveda cambió durante la revisión.');
      bytes = buffer.subarray(0, length);
    } finally { await file.close(); }
    let parsed: unknown;
    try { parsed = JSON.parse(bytes.toString('utf8')); }
    catch { return bytes.toString('base64'); }
    if (parsed && typeof parsed === 'object' && 'version' in parsed && parsed.version !== 1 && parsed.version !== 2) {
      throw new BrowserCredentialError('La versión de la bóveda no es compatible. No se modificó el archivo.');
    }
    this.assertSecureStorage();
    try { this.validateRecoverySecrets(this.decodeFile(parsed, destination).vault); }
    catch (error) { if (error instanceof UnsupportedCredentialVersion) throw error; return bytes.toString('base64'); }
    throw new BrowserCredentialError('El archivo principal existe y es válido. No se reemplazará mediante recuperación.');
  }

  private validateRecoverySecrets(vault: VaultFile): void {
    for (const entry of vault.credentials) {
      const ciphertext = Buffer.from(entry.passwordEncrypted, 'base64');
      if (ciphertext.toString('base64') !== entry.passwordEncrypted) throw new BrowserCredentialError('La bóveda o respaldo contiene una credencial inválida.');
      const secret = safeStorage.decryptString(ciphertext);
      if (!secret || secret.length > MAX_PASSWORD_LENGTH) throw new BrowserCredentialError('La bóveda o respaldo contiene una credencial inválida.');
    }
  }

  async list(origin?: string): Promise<BrowserCredentialMetadata[]> {
    const destination = this.filePath;
    const normalizedOrigin = origin ? normalizeCredentialOrigin(origin) : null;
    return this.enqueue(destination, async () => (await this.read(destination)).credentials
      .filter((item) => !normalizedOrigin || item.origin === normalizedOrigin)
      .map(toMetadata)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)));
  }

  async getAutosaveEnabled(): Promise<boolean> {
    const destination = this.filePath;
    return this.enqueue(destination, async () => (await this.read(destination)).autosaveEnabled === true);
  }

  async setAutosaveEnabled(enabled: boolean, assertCurrent: () => void): Promise<void> {
    if (typeof enabled !== 'boolean') throw new BrowserCredentialError('La preferencia de guardado no es válida.');
    const destination = this.filePath;
    await this.enqueue(destination, async () => {
      assertCurrent();
      const vault = await this.read(destination);
      assertCurrent();
      await this.write({ ...vault, autosaveEnabled: enabled }, destination, assertCurrent);
    });
  }

  async prepareSave(origin: string, rawInput: BrowserCredentialSaveInput): Promise<PreparedCredentialSave> {
    const destination = this.filePath;
    const normalizedOrigin = normalizeCredentialOrigin(origin);
    const input = validateCredentialInput(rawInput);
    this.assertSecureStorage();
    const passwordEncrypted = safeStorage.encryptString(input.password).toString('base64');
    input.password = '';
    const prepared = await this.enqueue(destination, async () => {
      const vault = await this.read(destination);
      const now = new Date().toISOString();
      const index = input.id
        ? vault.credentials.findIndex((item) => item.id === input.id && item.origin === normalizedOrigin)
        : vault.credentials.findIndex((item) => item.origin === normalizedOrigin && item.username === input.username);
      const current = index >= 0 ? vault.credentials[index] : null;
      if (input.id && !current) throw new BrowserCredentialError('La credencial ya no existe o no pertenece al sitio actual.');
      if (vault.credentials.some((item) => item.origin === normalizedOrigin && item.username === input.username && item.id !== current?.id)) {
        throw new BrowserCredentialError('Ya existe otra credencial con ese usuario en el sitio.');
      }
      if (!current && vault.credentials.length >= MAX_CREDENTIALS) {
        throw new BrowserCredentialError('La boveda alcanzo el limite de credenciales guardadas.');
      }
      const saved: StoredCredential = {
        id: current?.id ?? randomUUID(),
        origin: normalizedOrigin,
        username: input.username,
        createdAt: current?.createdAt ?? now,
        updatedAt: now,
        passwordEncrypted,
      };
      const revision = vaultRevision(vault);
      if (index >= 0) vault.credentials[index] = saved;
      else vault.credentials.push(saved);
      const unchanged = current !== null && safeStorage.decryptString(Buffer.from(current.passwordEncrypted, 'base64'))
        === safeStorage.decryptString(Buffer.from(passwordEncrypted, 'base64'));
      return { vault, saved, revision, updating: current !== null, unchanged };
    });
    const expiresAt = Date.now() + SAVE_REVIEW_TIMEOUT_MS;
    let consumed = false;
    return Object.freeze({
      origin: normalizedOrigin, username: input.username, updating: prepared.updating, unchanged: prepared.unchanged,
      commit: async (assertCurrent: () => void = () => {}) => {
        if (consumed) throw new BrowserCredentialError('La revisión de la credencial ya se utilizó.');
        consumed = true;
        const assertReview = () => {
          assertCurrent();
          if (Date.now() >= expiresAt) throw new BrowserCredentialError('La revisión de la credencial venció. Vuelve a guardarla.');
        };
        return this.enqueue(destination, async () => {
          assertReview();
          const current = await this.read(destination);
          assertReview();
          if (vaultRevision(current) !== prepared.revision) throw new BrowserCredentialError('La bóveda cambió durante la revisión. Vuelve a guardarla.');
          await this.write(prepared.vault, destination, assertReview);
          return toMetadata(prepared.saved);
        });
      },
    });
  }

  async save(origin: string, rawInput: BrowserCredentialSaveInput): Promise<BrowserCredentialMetadata> {
    const prepared = await this.prepareSave(origin, rawInput);
    return prepared.commit();
  }

  /** Descifra sólo en main para preparar una exportación explícitamente aprobada. */
  async exportTransfer(): Promise<BrowserCredentialTransferEntry[]> {
    const destination = this.filePath;
    this.assertSecureStorage();
    return this.enqueue(destination, async () => (await this.read(destination)).credentials.map((stored) => ({
      origin: stored.origin,
      username: stored.username,
      password: safeStorage.decryptString(Buffer.from(stored.passwordEncrypted, 'base64')),
    })));
  }

  /** Prepara una importación sin escribir; el commit queda retenido en main. */
  async prepareImport(entries: readonly BrowserCredentialTransferEntry[]): Promise<PreparedCredentialImport> {
    const destination = this.filePath;
    if (!Array.isArray(entries) || entries.length > MAX_CREDENTIALS) {
      throw new BrowserCredentialError('El archivo de contraseñas supera el límite permitido.');
    }
    this.assertSecureStorage();
    const candidates: BrowserCredentialTransferEntry[] = [];
    const seen = new Set<string>();
    const summary: BrowserCredentialImportSummary = { total: entries.length, newCount: 0, conflictCount: 0, duplicateCount: 0, invalidCount: 0 };
    for (const entry of entries) {
      try {
        if (!entry || typeof entry !== 'object' || Object.keys(entry).some((key) => !['origin', 'username', 'password'].includes(key))) throw new Error('shape');
        const origin = normalizeCredentialOrigin(entry.origin);
        const validated = validateCredentialInput({ username: entry.username, password: entry.password });
        const key = JSON.stringify([origin, validated.username]);
        if (seen.has(key)) { summary.duplicateCount++; continue; }
        seen.add(key);
        candidates.push({ origin, username: validated.username, password: validated.password });
      } catch { summary.invalidCount++; }
    }
    let baseline = '';
    await this.enqueue(destination, async () => {
      const vault = await this.read(destination);
      baseline = vaultRevision(vault);
      const existing = new Set(vault.credentials.map((item) => JSON.stringify([item.origin, item.username])));
      for (const candidate of candidates) {
        if (existing.has(JSON.stringify([candidate.origin, candidate.username]))) summary.conflictCount++;
        else summary.newCount++;
      }
      if (vault.credentials.length + summary.newCount > MAX_CREDENTIALS) throw new BrowserCredentialError('La importación supera el límite de credenciales.');
    });
    const expiresAt = Date.now() + SAVE_REVIEW_TIMEOUT_MS;
    let consumed = false;
    return {
      summary: Object.freeze({ ...summary }),
      commit: async (mode, assertCurrent = () => {}) => {
        if (mode !== 'skip' && mode !== 'update') throw new BrowserCredentialError('La resolución de conflictos no es válida.');
        if (consumed) throw new BrowserCredentialError('La revisión de importación ya se utilizó.');
        consumed = true;
        const assertReview = () => {
          assertCurrent();
          if (Date.now() >= expiresAt) throw new BrowserCredentialError('La revisión de importación venció. Vuelve a seleccionar el archivo.');
        };
        let imported = 0;
        let updated = 0;
        let skipped = 0;
        await this.enqueue(destination, async () => {
          assertReview();
          const current = await this.read(destination);
          if (vaultRevision(current) !== baseline) throw new BrowserCredentialError('La bóveda cambió. Revisa la importación de nuevo.');
          const now = new Date().toISOString();
          for (const candidate of candidates) {
            const index = current.credentials.findIndex((item) => item.origin === candidate.origin && item.username === candidate.username);
            if (index < 0) {
              current.credentials.push({ id: randomUUID(), origin: candidate.origin, username: candidate.username, createdAt: now, updatedAt: now, passwordEncrypted: safeStorage.encryptString(candidate.password).toString('base64') });
              imported++;
            } else if (mode === 'update') {
              const previous = current.credentials[index];
              current.credentials[index] = { ...previous, updatedAt: now, passwordEncrypted: safeStorage.encryptString(candidate.password).toString('base64') };
              updated++;
            } else skipped++;
          }
          if (imported || updated) await this.write(current, destination, assertReview);
        });
        return { imported, updated, skipped };
      },
    };
  }

  async resolveSecret(id: string, currentOrigin: string): Promise<{ metadata: BrowserCredentialMetadata; password: string }> {
    const destination = this.filePath;
    validateId(id);
    const origin = normalizeCredentialOrigin(currentOrigin);
    this.assertSecureStorage();
    return this.enqueue(destination, async () => {
      const vault = await this.read(destination);
      const stored = vault.credentials.find((item) => item.id === id && item.origin === origin);
      if (!stored) throw new BrowserCredentialError('La credencial no pertenece al sitio actual.');
      const decrypted = safeStorage.decryptString(Buffer.from(stored.passwordEncrypted, 'base64'));
      return { metadata: toMetadata(stored), password: decrypted };
    });
  }

  async remove(id: string, currentOrigin: string, assertCurrent: () => void = () => {}): Promise<boolean> {
    const destination = this.filePath;
    validateId(id);
    const origin = normalizeCredentialOrigin(currentOrigin);
    let removed = false;
    await this.enqueue(destination, async () => {
      assertCurrent();
      const vault = await this.read(destination);
      assertCurrent();
      const next = vault.credentials.filter((item) => item.id !== id || item.origin !== origin);
      removed = next.length !== vault.credentials.length;
      if (removed) await this.write({ ...vault, credentials: next }, destination, assertCurrent, false);
    });
    return removed;
  }

  /**
   * Vacia la boveda del perfil activo y devuelve cuantas credenciales quito.
   *
   * A diferencia de `remove`, no exige origen: quien la invoca es el borrado de
   * datos de navegacion, que actua sobre todo el perfil y no sobre el sitio
   * abierto. Descifra metadata para contar; nunca devuelve secretos.
   */
  async clearAll(assertCurrent: () => void = () => {}): Promise<number> {
    const destination = this.filePath;
    let removed = 0;
    await this.enqueue(destination, async () => {
      assertCurrent();
      const vault = await this.read(destination);
      assertCurrent();
      removed = vault.credentials.length;
      await this.write({ ...vault, credentials: [] }, destination, assertCurrent, false);
    });
    return removed;
  }

  /** Analiza en main y devuelve sólo hallazgos; nunca contraseñas ni hashes. */
  async analyzeHealth(): Promise<BrowserCredentialHealth[]> {
    const destination = this.filePath;
    this.assertSecureStorage();
    return this.enqueue(destination, async () => {
      const vault = await this.read(destination);
      const inspected = vault.credentials.map((credential) => {
        const password = safeStorage.decryptString(Buffer.from(credential.passwordEncrypted, 'base64'));
        return { credential, password, fingerprint: createHash('sha256').update(password).digest('hex') };
      });
      const counts = new Map<string, number>();
      inspected.forEach(({ fingerprint }) => counts.set(fingerprint, (counts.get(fingerprint) ?? 0) + 1));
      return inspected.map(({ credential, password, fingerprint }) => {
        const reasons = passwordWeaknessReasons(password);
        const reused = (counts.get(fingerprint) ?? 0) > 1;
        if (reused) reasons.push('Se reutiliza en otra credencial.');
        return { id: credential.id, weak: reasons.some((reason) => reason !== 'Se reutiliza en otra credencial.'), reused, reasons };
      });
    });
  }

  private enqueue<T>(destination: string, operation: () => Promise<T>): Promise<T> {
    const pending = (fileQueues.get(destination) ?? Promise.resolve()).then(operation);
    const settled = pending.then(() => undefined, () => undefined);
    fileQueues.set(destination, settled);
    void settled.then(() => { if (fileQueues.get(destination) === settled) fileQueues.delete(destination); });
    return pending;
  }

  private assertSecureStorage(): void {
    assertCredentialSecureStorage();
  }

  private async read(destination: string): Promise<VaultFile> {
    const current = await this.readFile(destination);
    if (!current) {
      if (await this.fileExists(`${destination}.bak`)) throw new BrowserCredentialError('Falta el archivo principal de contraseñas. Revisa la recuperación del respaldo.');
      return { version: 1, credentials: [] };
    }
    // La lectura está dentro de la cola: la migración no compite con otro store
    // ni sobrevive a flush() sin que la limpieza del perfil la espere.
    if (current.legacy) await this.write(current.vault, destination);
    return current.vault;
  }

  private async readFile(destination: string, scopeDestination = destination): Promise<{ vault: VaultFile; legacy: boolean } | null> {
    try {
      const file = await fs.open(destination, 'r');
      let data: Buffer;
      try {
        const stat = await file.stat();
        if (!stat.isFile()) throw new Error('La bóveda no es un archivo regular.');
        const size = stat.size;
        if (size > MAX_CREDENTIAL_VAULT_FILE_BYTES) throw new Error('La bóveda excede el tamaño permitido.');
        const buffer = Buffer.alloc(size + 1);
        let length = 0;
        while (length < buffer.length) {
          const { bytesRead } = await file.read(buffer, length, buffer.length - length, null);
          if (!bytesRead) break;
          length += bytesRead;
        }
        if (length !== size || (await file.stat()).size !== size) throw new Error('La bóveda cambió durante la lectura.');
        data = buffer.subarray(0, length);
      } finally { await file.close(); }
      const envelope: unknown = JSON.parse(data.toString('utf8'));
      return this.decodeFile(envelope, scopeDestination);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
      if (error instanceof BrowserCredentialError) throw error;
      console.error('[Navegador][Bóveda] No se pudo leer la bóveda.');
      throw new BrowserCredentialError('La boveda de contrasenas esta danada o no se puede leer.');
    }
  }

  private decodeFile(envelope: unknown, scopeDestination: string): { vault: VaultFile; legacy: boolean } {
      if (!envelope || typeof envelope !== 'object' || Array.isArray(envelope) || !('version' in envelope)) throw new Error('formato');
      if (envelope.version !== 1 && envelope.version !== 2) throw new UnsupportedCredentialVersion('La versión de la bóveda no es compatible. No se modificó el archivo.');
      this.assertSecureStorage();
      const legacy = envelope.version === 1;
      const parsed = (legacy ? envelope : JSON.parse(openCredentialVault(envelope, vaultScope(scopeDestination)))) as Partial<VaultFile>;
      if (parsed && parsed.version !== undefined && parsed.version !== 1) throw new UnsupportedCredentialVersion('La versión interna de la bóveda no es compatible.');
      if (parsed.version !== 1 || !Array.isArray(parsed.credentials)
        || (parsed.autosaveEnabled !== undefined && typeof parsed.autosaveEnabled !== 'boolean')) {
        throw new Error('El formato de la boveda de contrasenas no es valido.');
      }
      if (parsed.credentials.length > MAX_CREDENTIALS || !parsed.credentials.every(isStoredCredential)) {
        throw new Error('La boveda contiene una credencial invalida.');
      }
      if (new Set(parsed.credentials.map((item) => item.id)).size !== parsed.credentials.length
        || new Set(parsed.credentials.map((item) => JSON.stringify([item.origin, item.username]))).size !== parsed.credentials.length) {
        throw new Error('La bóveda contiene cuentas duplicadas.');
      }
      return { vault: { version: 1, credentials: parsed.credentials,
        ...(parsed.autosaveEnabled === undefined ? {} : { autosaveEnabled: parsed.autosaveEnabled }) }, legacy };
  }

  private async write(vault: VaultFile, destination: string, assertCurrent: () => void = () => {}, preservePrevious = true): Promise<void> {
    assertCurrent();
    this.assertSecureStorage();
    const previous = await this.readFile(destination);
    assertCurrent();
    const scope = vaultScope(destination);
    const encrypted = sealCredentialVault(JSON.stringify(vault), scope);
    if (!preservePrevious) await this.removeRecoveryCopies(destination, assertCurrent);
    if (previous || !preservePrevious) {
      // Borrar no deja la credencial eliminada en el respaldo. Si falla el
      // reemplazo final se informa error y el principal anterior queda intacto.
      const backup = sealCredentialVault(JSON.stringify(preservePrevious ? previous!.vault : vault), scope);
      await this.replaceFile(`${destination}.bak`, backup, assertCurrent);
    }
    await this.replaceFile(destination, encrypted, assertCurrent);
  }

  /** Borrar cuentas retira también archivos de recuperación que puedan contenerlas. */
  private async removeRecoveryCopies(destination: string, assertCurrent: () => void): Promise<void> {
    const directory = path.dirname(destination);
    let names: string[];
    try { names = await fs.readdir(directory); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return; throw error; }
    const prefix = `${path.basename(destination)}.corrupt-`;
    for (const name of names) {
      if (!name.startsWith(prefix) || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(name.slice(prefix.length))) continue;
      assertCurrent();
      const filename = path.join(directory, name);
      const stat = await fs.lstat(filename);
      if (!stat.isFile() || stat.isSymbolicLink()) throw new BrowserCredentialError('Una copia de recuperación no es un archivo regular. El borrado no se completó.');
      assertCurrent(); await fs.unlink(filename);
    }
  }

  private async replaceFile(destination: string, encrypted: string, assertCurrent: () => void): Promise<void> {
    assertCurrent();
    await fs.mkdir(path.dirname(destination), { recursive: true });
    const temporary = `${destination}.${randomUUID()}.tmp`;
    try {
      const file = await fs.open(temporary, 'wx', 0o600);
      try { await file.writeFile(encrypted, 'utf8'); await file.sync(); }
      finally { await file.close(); }
      assertCurrent();
      await fs.rename(temporary, destination);
    } finally { await fs.unlink(temporary).catch(() => undefined); }
  }
}

function vaultScope(destination: string): string {
  // El hash del perfil y nombre del store permanecen estables al mover userData.
  // Trasladar el archivo a otro perfil exige la transferencia explícita, no copiarlo.
  return JSON.stringify([path.basename(path.dirname(destination)), path.basename(destination)]);
}

export function passwordWeaknessReasons(password: string): string[] {
  const reasons: string[] = [];
  if (password.length < 12) reasons.push('Tiene menos de 12 caracteres.');
  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((pattern) => pattern.test(password)).length;
  if (classes < 3) reasons.push('Usa poca variedad de caracteres.');
  if (/^(password|contrase(?:ñ|n)a|qwerty|123456|admin|welcome)/i.test(password)) reasons.push('Coincide con un patrón común.');
  if (/(.)\1{3,}/.test(password)) reasons.push('Contiene demasiados caracteres repetidos.');
  return reasons;
}

export function normalizeCredentialOrigin(raw: string): string {
  let url: URL;
  try { url = new URL(raw); } catch { throw new BrowserCredentialError('El origen de la credencial no es valido.'); }
  const localHttp = url.protocol === 'http:' && (url.hostname === 'localhost' || url.hostname === '127.0.0.1');
  if ((url.protocol !== 'https:' && !localHttp) || url.username || url.password) {
    throw new BrowserCredentialError('Las contrasenas solo se guardan para HTTPS o localhost.');
  }
  return url.origin;
}

function validateCredentialInput(raw: BrowserCredentialSaveInput): BrowserCredentialSaveInput {
  if (!raw || typeof raw !== 'object') throw new Error('La credencial es invalida.');
  const username = typeof raw.username === 'string' ? raw.username.trim() : '';
  const password = typeof raw.password === 'string' ? raw.password : '';
  if (!username || username.length > MAX_USERNAME_LENGTH || hasControlCharacter(username)) throw new Error('El usuario de la credencial es invalido.');
  if (!password || password.length > MAX_PASSWORD_LENGTH) throw new Error('La contrasena es invalida.');
  if (raw.id !== undefined) validateId(raw.id);
  return { id: raw.id, username, password };
}

function validateId(id: unknown): asserts id is string {
  if (typeof id !== 'string' || !/^[a-f\d-]{16,64}$/i.test(id)) throw new Error('Identificador de credencial invalido.');
}

function isStoredCredential(value: unknown): value is StoredCredential {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<StoredCredential>;
  if (typeof item.id !== 'string' || !/^[a-f\d-]{16,64}$/i.test(item.id)) return false;
  if (typeof item.origin !== 'string' || typeof item.username !== 'string' || !item.username || item.username.length > MAX_USERNAME_LENGTH || hasControlCharacter(item.username)) return false;
  if (typeof item.createdAt !== 'string' || Number.isNaN(Date.parse(item.createdAt)) || typeof item.updatedAt !== 'string' || Number.isNaN(Date.parse(item.updatedAt))) return false;
  // UTF-8 + cifrado + base64 pueden exceder 16 KiB con 4.096 caracteres Unicode.
  if (typeof item.passwordEncrypted !== 'string' || !item.passwordEncrypted || item.passwordEncrypted.length > 24_576) return false;
  try { return normalizeCredentialOrigin(item.origin) === item.origin; } catch { return false; }
}

function toMetadata(value: StoredCredential): BrowserCredentialMetadata {
  const { id, origin, username, createdAt, updatedAt } = value;
  return { id, origin, username, createdAt, updatedAt };
}

function vaultRevision(vault: VaultFile): string {
  return createHash('sha256').update(JSON.stringify(vault)).digest('hex');
}

function hasControlCharacter(value: string): boolean {
  return Array.from(value).some((character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127);
}
