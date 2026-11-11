import { app } from 'electron';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { readPrivateFile, replacePrivateFile } from '../storage/private-files';
import { systemCipher, type OsCipher } from '../storage/os-cipher';
import { buildDefaultState } from './state-utils';
import { REMOTE_NODE_STATE_BYTES, remoteNodeOwner, remoteNodePayload, remoteNodePrivatePayload, storedRemoteNode } from './state-contract';
import type { RemoteNodeState } from './types';

const MAGIC = Buffer.from('SOFLIA-REMOTE-NODE-1\n');
const LEGACY_MAGIC = Buffer.from('SOFLIA-REMOTE-NODE-LEGACY-1\n');
const legacyState = z.object({ host: z.unknown().optional(), nodes: z.array(z.unknown()).max(4096).optional() }).passthrough();
const archiveSchema = z.object({ version: z.literal(1), kind: z.literal('legacy'), state: legacyState }).strict();
export class RemoteNodeStorageUnavailableError extends Error {
  constructor() { super('Activa el almacenamiento cifrado del sistema y vuelve a iniciar sesión.'); }
}

/** Cola única para preservar orden de migración y guardados incluso entre A/B/A. */
export class RemoteNodeCredentialStore {
  private queue: Promise<unknown> = Promise.resolve();
  private legacyProtected = false;
  constructor(private readonly options: { root?: () => string; cipher?: OsCipher; replace?: typeof replacePrivateFile } = {}) {}
  private get cipher() { return this.options.cipher ?? systemCipher; }
  private root() { return this.options.root?.() ?? app.getPath('userData'); }
  private file(owner: string) { return path.join(this.root(), 'remote-node-credentials', createHash('sha256').update(remoteNodeOwner.parse(owner)).digest('hex') + '.bin'); }
  private run<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.queue.then(operation).catch(error => {
      if (error instanceof RemoteNodeStorageUnavailableError) throw error;
      throw new Error('No se pudo leer o guardar el perfil cifrado de nodos. Se conservan los datos anteriores.');
    });
    this.queue = result.catch(() => undefined); return result;
  }
  private async available(assert: () => void) {
    assert(); if (!await this.cipher.available()) throw new RemoteNodeStorageUnavailableError(); assert();
  }
  private async encode(value: unknown, magic: Buffer, assert: () => void) {
    assert(); const text = JSON.stringify(value);
    if (Buffer.byteLength(text, 'utf8') > REMOTE_NODE_STATE_BYTES) throw new Error('Perfil de nodos excesivo.');
    const encrypted = await this.cipher.encrypt(text); assert(); return Buffer.concat([magic, encrypted]);
  }
  private async decode(data: Buffer, magic: Buffer, assert: () => void) {
    if (!data.subarray(0, magic.length).equals(magic)) throw new Error('Formato de nodos no admitido.');
    const decoded = await this.cipher.decrypt(data.subarray(magic.length)); assert();
    if (Buffer.byteLength(decoded.result, 'utf8') > REMOTE_NODE_STATE_BYTES) throw new Error('Perfil de nodos excesivo.');
    return { value: JSON.parse(decoded.result) as unknown, rotate: decoded.shouldReEncrypt };
  }
  private replace(file: string, data: Buffer, assert: () => void) {
    return (this.options.replace ?? replacePrivateFile)(file, data, assert, REMOTE_NODE_STATE_BYTES);
  }
  private async legacy(assert: () => void) {
    const file = path.join(this.root(), 'remote-node-state.json');
    const data = await readPrivateFile(file, REMOTE_NODE_STATE_BYTES); assert();
    if (data === null) { this.legacyProtected = true; return null; }
    if (data.subarray(0, LEGACY_MAGIC.length).equals(LEGACY_MAGIC)) {
      const decoded = await this.decode(data, LEGACY_MAGIC, assert);
      const archive = archiveSchema.parse(decoded.value);
      if (decoded.rotate) await this.replace(file, await this.encode(archive, LEGACY_MAGIC, assert), assert);
      this.legacyProtected = true; return archive.state;
    }
    const state = legacyState.parse(JSON.parse(data.toString('utf8')));
    await this.replace(file, await this.encode({ version: 1, kind: 'legacy', state }, LEGACY_MAGIC, assert), assert);
    this.legacyProtected = true; return state;
  }
  async load(owner: string, assert: () => void): Promise<RemoteNodeState> {
    if (!remoteNodeOwner.safeParse(owner).success) throw new Error('Propietario de nodos no válido.');
    return this.run(async () => {
      await this.available(assert);
      const legacy = await this.legacy(assert);
      const file = this.file(owner), data = await readPrivateFile(file, REMOTE_NODE_STATE_BYTES); assert();
      if (data !== null) {
        const decoded = await this.decode(data, MAGIC, assert);
        const payload = remoteNodePrivatePayload.parse(decoded.value);
        if (payload.owner !== owner) throw new Error('Propietario de nodos incorrecto.');
        if (decoded.rotate) await this.replace(file, await this.encode(payload, MAGIC, assert), assert);
        assert(); return payload.state;
      }
      const state = buildDefaultState(); let pending = 0;
      for (const record of legacy?.nodes ?? []) {
        const ownerValue = record && typeof record === 'object' && 'owner_user_id' in record ? record.owner_user_id : null;
        if (!ownerValue) { pending++; continue; }
        if (ownerValue !== owner) continue;
        const parsed = storedRemoteNode.safeParse(record);
        if (parsed.success) state.nodes.push(parsed.data); else pending++;
      }
      if (legacy) state.migration = { pendingNodes: pending, hostPending: legacy.host !== undefined && legacy.host !== null };
      const payload = remoteNodePayload(owner, state);
      await this.replace(file, await this.encode(payload, MAGIC, assert), assert);
      assert(); return payload.state;
    });
  }
  async save(owner: string, state: RemoteNodeState, assert: () => void): Promise<void> {
    const payload = remoteNodePayload(owner, state);
    return this.run(async () => {
      await this.available(assert); if (!this.legacyProtected) await this.legacy(assert);
      await this.replace(this.file(owner), await this.encode(payload, MAGIC, assert), assert); assert();
    });
  }
}
