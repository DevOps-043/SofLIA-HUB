import { app } from 'electron';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { CalendarConnection } from './types';
import { readCredentialFile, replaceCredentialFile } from './credential-files';
import { systemCipher } from '../storage/os-cipher';
export type { OsCipher as CalendarCipher } from '../storage/os-cipher';
import type { OsCipher as CalendarCipher } from '../storage/os-cipher';

const MAGIC = Buffer.from('SOFLIA-CALENDAR-1\n');
const LEGACY_MAGIC = Buffer.from('SOFLIA-CALENDAR-LEGACY-1\n');
const ownerSchema = z.string().min(1).max(320);
const connectionSchema = z.object({
  id: z.string().max(1024).optional(), userId: ownerSchema,
  provider: z.enum(['google', 'microsoft']), email: z.string().max(320).optional(),
  accessToken: z.string().min(1).max(65536), refreshToken: z.string().max(65536),
  tokenExpiry: z.iso.datetime({ offset: true }).optional(), calendarId: z.string().max(1024).optional(), isActive: z.boolean(),
}).strict();
const connectionsSchema = z.array(connectionSchema).max(2).refine(items => new Set(items.map(item => item.provider)).size === items.length);
const payloadSchema = z.object({ version: z.literal(1), userId: ownerSchema, connections: connectionsSchema }).strict();
const archiveSchema = z.object({ version: z.literal(1), kind: z.literal('legacy'), records: z.array(z.unknown()).max(100) }).strict();

export class CalendarStorageUnavailableError extends Error {
  constructor() { super('No hay almacenamiento cifrado seguro para el calendario.'); }
}

/** Custodia privada del calendario; todas las operaciones del archivo heredado comparten cola. */
export class CalendarCredentialStore {
  private queue: Promise<unknown> = Promise.resolve();
  constructor(private readonly options: {
    root?: () => string; cipher?: CalendarCipher;
    replace?: typeof replaceCredentialFile;
  } = {}) {}
  private get cipher() { return this.options.cipher ?? systemCipher; }
  private root() { return this.options.root?.() ?? app.getPath('userData'); }
  private file(owner: string) { return path.join(this.root(), 'calendar-credentials', createHash('sha256').update(ownerSchema.parse(owner)).digest('hex') + '.bin'); }
  private run<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.queue.then(operation);
    this.queue = result.catch(() => {});
    return result;
  }
  private async available(assert: () => void) {
    assert();
    if (!await this.cipher.available()) throw new CalendarStorageUnavailableError();
    assert();
  }
  private replace(file: string, data: Buffer, assert: () => void) {
    return (this.options.replace ?? replaceCredentialFile)(file, data, assert);
  }
  private async encode(value: unknown, magic: Buffer, assert: () => void) {
    assert();
    const encrypted = await this.cipher.encrypt(JSON.stringify(value));
    assert();
    return Buffer.concat([magic, encrypted]);
  }
  private async decode(data: Buffer, magic: Buffer, assert: () => void) {
    if (!data.subarray(0, magic.length).equals(magic)) throw new Error('Formato de credenciales no admitido.');
    const decoded = await this.cipher.decrypt(data.subarray(magic.length));
    assert();
    return { value: JSON.parse(decoded.result) as unknown, rotate: decoded.shouldReEncrypt };
  }
  private async legacy(assert: () => void): Promise<unknown[]> {
    const file = path.join(this.root(), 'calendar-connections.json');
    const data = await readCredentialFile(file);
    assert();
    if (!data) return [];
    if (data.subarray(0, LEGACY_MAGIC.length).equals(LEGACY_MAGIC)) {
      const decoded = await this.decode(data, LEGACY_MAGIC, assert);
      const archive = archiveSchema.parse(decoded.value);
      if (decoded.rotate) await this.replace(file, await this.encode(archive, LEGACY_MAGIC, assert), assert);
      return archive.records;
    }
    const records = z.array(z.unknown()).max(100).parse(JSON.parse(data.toString('utf8')));
    const encoded = await this.encode({ version: 1, kind: 'legacy', records }, LEGACY_MAGIC, assert);
    await this.replace(file, encoded, assert);
    return records;
  }
  private payload(owner: string, connections: CalendarConnection[]) {
    const payload = payloadSchema.parse({ version: 1, userId: owner, connections: connections.map(connection => ({
      ...connection, tokenExpiry: connection.tokenExpiry?.toISOString(),
    })) });
    if (payload.connections.some(connection => connection.userId !== owner)) throw new Error('Propietario de credencial incorrecto.');
    return payload;
  }
  load(owner: string, assert: () => void): Promise<CalendarConnection[]> {
    ownerSchema.parse(owner);
    return this.run(async () => {
      await this.available(assert);
      const legacy = await this.legacy(assert);
      const file = this.file(owner);
      const data = await readCredentialFile(file);
      assert();
      if (data) {
        const decoded = await this.decode(data, MAGIC, assert);
        const payload = payloadSchema.parse(decoded.value);
        if (payload.userId !== owner || payload.connections.some(connection => connection.userId !== owner)) throw new Error('Propietario de credencial incorrecto.');
        if (decoded.rotate) await this.replace(file, await this.encode(payload, MAGIC, assert), assert);
        return payload.connections.map(connection => ({ ...connection, tokenExpiry: connection.tokenExpiry ? new Date(connection.tokenExpiry) : undefined }));
      }
      const owned = legacy.filter(record => record !== null && typeof record === 'object' && 'userId' in record && record.userId === owner);
      const connections = connectionsSchema.parse(owned).map(connection => ({ ...connection, tokenExpiry: connection.tokenExpiry ? new Date(connection.tokenExpiry) : undefined }));
      if (connections.length) await this.replace(file, await this.encode(this.payload(owner, connections), MAGIC, assert), assert);
      assert();
      return connections;
    });
  }
  save(owner: string, connections: CalendarConnection[], assert: () => void): Promise<void> {
    const payload = this.payload(owner, connections);
    return this.run(async () => {
      await this.available(assert);
      await this.legacy(assert);
      await this.replace(this.file(owner), await this.encode(payload, MAGIC, assert), assert);
    });
  }
}
