import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { browserProfilePath, resolveStoreLocation } from './profile-scope';
import type { BrowserEnterprisePolicy } from './platform-types';

type PolicyFile = { schemaVersion: 1; policy: BrowserEnterprisePolicy; sourceRevision: string; appliedAt: string };

export interface BrowserEnterprisePolicyStatus {
  managed: boolean;
  policy: BrowserEnterprisePolicy | null;
  sourceRevision: string | null;
  appliedAt: string | null;
  lastError: string | null;
}

/** Store cerrado: una entrada inválida jamás reemplaza la última política válida. */
export class BrowserEnterprisePolicyStore {
  private lastError: string | null = null;
  private writeQueue = Promise.resolve();
  private lastValid = new Map<string, PolicyFile>();

  constructor(private readonly location: string | (() => string) = () => browserProfilePath('enterprise-policy.json')) {}

  async flush(): Promise<void> {
    await this.writeQueue;
  }

  invalidateCache(): void {
    this.lastValid.delete(this.filePath);
    this.lastError = null;
  }

  async getStatus(): Promise<BrowserEnterprisePolicyStatus> {
    const destination = this.filePath;
    const pending = this.writeQueue.then(async () => {
    const file = await this.read(destination);
    return {
      managed: Boolean(file),
      policy: file ? clonePolicy(file.policy) : null,
      sourceRevision: file?.sourceRevision ?? null,
      appliedAt: file?.appliedAt ?? null,
      lastError: this.lastError,
    };
    });
    this.writeQueue = pending.then(() => undefined, () => undefined);
    return pending;
  }

  async apply(raw: unknown, sourceRevision: string): Promise<BrowserEnterprisePolicyStatus> {
    const destination = this.filePath;
    try {
      const policy = validateEnterprisePolicy(raw);
      if (typeof sourceRevision !== 'string' || !/^[A-Za-z0-9._:-]{1,100}$/.test(sourceRevision)) throw new Error('La revisión de política es inválida.');
      await this.enqueue(() => this.write({ schemaVersion: 1, policy, sourceRevision, appliedAt: new Date().toISOString() }, destination));
      this.lastError = null;
    } catch (error) {
      this.lastError = safeError(error);
    }
    return this.getStatus();
  }

  private get filePath(): string { return resolveStoreLocation(this.location); }

  private async enqueue(operation: () => Promise<void>) {
    const pending = this.writeQueue.then(operation);
    this.writeQueue = pending.catch(() => undefined);
    await pending;
  }

  private async readFile(destination: string): Promise<PolicyFile | null> {
    try {
      const parsed = JSON.parse(await fs.readFile(destination, 'utf8')) as Partial<PolicyFile>;
      if (parsed.schemaVersion !== 1 || typeof parsed.sourceRevision !== 'string' || !/^[A-Za-z0-9._:-]{1,100}$/.test(parsed.sourceRevision)
        || typeof parsed.appliedAt !== 'string' || Number.isNaN(Date.parse(parsed.appliedAt))) throw new Error('Formato de política inválido.');
      return { schemaVersion: 1, policy: validateEnterprisePolicy(parsed.policy), sourceRevision: parsed.sourceRevision, appliedAt: parsed.appliedAt };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw error;
    }
  }

  private async read(destination: string): Promise<PolicyFile | null> {
    let failure: unknown;
    try {
      const current = await this.readFile(destination);
      if (current) { this.lastValid.set(destination, current); return current; }
    } catch (error) { failure = error; }
    const cached = this.lastValid.get(destination);
    if (cached) { this.lastError = 'Se conserva la última política válida; el archivo actual no está disponible.'; return cached; }
    try {
      const backup = await this.readFile(`${destination}.bak`);
      if (backup) {
        this.lastValid.set(destination, backup);
        this.lastError = 'Se recuperó la última política válida desde el respaldo.';
        return backup;
      }
    } catch (error) { failure = failure ?? error; }
    if (failure) {
      const wrapped = new Error('No se puede verificar la política empresarial; el acceso administrado queda bloqueado.');
      Object.defineProperty(wrapped, 'cause', { value: failure });
      throw wrapped;
    }
    return null;
  }

  private async write(file: PolicyFile, destination: string): Promise<void> {
    const temporary = `${destination}.${randomUUID()}.tmp`;
    const backup = `${destination}.bak`;
    await fs.mkdir(path.dirname(destination), { recursive: true });
    try {
      await fs.writeFile(temporary, JSON.stringify(file, null, 2), { encoding: 'utf8', mode: 0o600, flag: 'wx' });
      // Copiar el respaldo no crea una ventana sin política activa.
      const previous = await this.read(destination);
      if (previous) await fs.writeFile(backup, JSON.stringify(previous), { encoding: 'utf8', mode: 0o600 });
      await fs.rename(temporary, destination);
      this.lastValid.set(destination, file);
    } finally {
      await fs.unlink(temporary).catch((error: NodeJS.ErrnoException) => { if (error.code !== 'ENOENT') throw error; });
    }
  }
}

export function validateEnterprisePolicy(raw: unknown): BrowserEnterprisePolicy {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('La política empresarial es inválida.');
  const value = raw as Record<string, unknown>;
  const allowed = new Set(['version', 'blockedOrigins', 'forcedPrivacyLevel', 'extensionsAllowed', 'agentAllowed', 'historyRetentionDays']);
  if (Object.keys(value).some((key) => !allowed.has(key))) throw new Error('La política contiene campos no soportados.');
  if (value.version !== 1 || !Array.isArray(value.blockedOrigins) || value.blockedOrigins.length > 1_000
    || typeof value.extensionsAllowed !== 'boolean' || typeof value.agentAllowed !== 'boolean') throw new Error('La política empresarial es inválida.');
  if (value.forcedPrivacyLevel !== null && !['balanced', 'strict'].includes(value.forcedPrivacyLevel as string)) throw new Error('El nivel de privacidad administrado no puede reducir la protección.');
  if (value.historyRetentionDays !== null && (typeof value.historyRetentionDays !== 'number' || !Number.isSafeInteger(value.historyRetentionDays) || value.historyRetentionDays < 0 || value.historyRetentionDays > 3_650)) throw new Error('La retención administrada es inválida.');
  const blockedOrigins = [...new Set(value.blockedOrigins.map(normalizeBlockedOrigin))].sort();
  return {
    version: 1,
    blockedOrigins,
    forcedPrivacyLevel: value.forcedPrivacyLevel as BrowserEnterprisePolicy['forcedPrivacyLevel'],
    extensionsAllowed: value.extensionsAllowed,
    agentAllowed: value.agentAllowed,
    historyRetentionDays: value.historyRetentionDays as number | null,
  };
}

function normalizeBlockedOrigin(raw: unknown): string {
  if (typeof raw !== 'string') throw new Error('La política contiene un origen inválido.');
  const url = new URL(raw);
  if ((url.protocol !== 'https:' && url.protocol !== 'http:') || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw new Error('La política contiene un origen inválido.');
  return url.origin;
}

function clonePolicy(policy: BrowserEnterprisePolicy): BrowserEnterprisePolicy {
  return { ...policy, blockedOrigins: [...policy.blockedOrigins] };
}

function safeError(error: unknown): string {
  return (error instanceof Error ? error.message : String(error)).replace(/[\r\n\t]+/g, ' ').slice(0, 200);
}
