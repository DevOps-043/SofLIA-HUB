import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RemoteNodeCredentialStore, RemoteNodeStorageUnavailableError } from '../remote-node/state-store';
import { replacePrivateFile } from '../storage/private-files';
import type { OsCipher } from '../storage/os-cipher';

let root: string; let store: RemoteNodeCredentialStore;
let available: ReturnType<typeof vi.fn<OsCipher['available']>>;
let encrypt: ReturnType<typeof vi.fn<OsCipher['encrypt']>>;
let decrypt: ReturnType<typeof vi.fn<OsCipher['decrypt']>>;
const assert = () => undefined;
const node = (owner: string, id = 'node-' + owner) => ({ id, name: 'Nodo de ' + owner, baseUrl: 'https://node.invalid', token: 'credencial-ficticia-' + owner,
  enabled: true, owner_user_id: owner, createdAt: '2026-10-26', updatedAt: '2026-10-26', capabilities: ['capacidad-futura'] });
const file = (owner: string) => path.join(root, 'remote-node-credentials', createHash('sha256').update(owner).digest('hex') + '.bin');
beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'soflia-remote-creds-test-'));
  const key = randomBytes(32);
  available = vi.fn(async () => true);
  encrypt = vi.fn(async text => {
    const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', key, iv);
    const payload = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
    return Buffer.concat([iv, cipher.getAuthTag(), payload]);
  });
  decrypt = vi.fn(async bytes => {
    const decipher = createDecipheriv('aes-256-gcm', key, bytes.subarray(0, 12)); decipher.setAuthTag(bytes.subarray(12, 28));
    return { result: Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString('utf8'), shouldReEncrypt: false };
  });
  store = new RemoteNodeCredentialStore({ root: () => root, cipher: { available, encrypt, decrypt } });
});
afterEach(async () => {
  const resolved = path.resolve(root);
  if (path.dirname(resolved) !== path.resolve(os.tmpdir()) || !path.basename(resolved).startsWith('soflia-remote-creds-test-')) throw new Error('Ruta de limpieza no válida.');
  await fs.rm(resolved, { recursive: true, force: true });
});
describe('Custodia cifrada de perfiles de nodos con filesystem propio', () => {
  it('guarda cifrado, restaura y separa A/B sin temporales planos', async () => {
    const state = await store.load('user-a', assert); state.nodes.push(node('user-a')); await store.save('user-a', state, assert);
    const bytes = await fs.readFile(file('user-a'));
    expect(bytes.includes(Buffer.from(state.host.token))).toBe(false); expect(bytes.includes(Buffer.from(state.nodes[0].token))).toBe(false);
    expect((await store.load('user-a', assert)).nodes).toEqual(state.nodes);
    expect((await store.load('user-b', assert)).nodes).toEqual([]);
    expect((await fs.readdir(path.join(root, 'remote-node-credentials'))).every(name => name.endsWith('.bin'))).toBe(true);
  });
  it('rechaza copiar el perfil cifrado de A sobre la ruta de B', async () => {
    await store.load('user-a', assert); await fs.copyFile(file('user-a'), file('user-b'));
    await expect(store.load('user-b', assert)).rejects.toThrow('perfil cifrado');
  });
  it('no asigna el host ni huérfanos y preserva todo el legado cifrado', async () => {
    const orphan = { ...node('orphan'), owner_user_id: null, extra: 'dato legado preservado' };
    const legacy = { host: { token: 'host-heredado-ficticio', enabled: true }, nodes: [node('user-a'), node('user-b'), orphan], extra: { version: 'legado' } };
    const legacyFile = path.join(root, 'remote-node-state.json'); await fs.writeFile(legacyFile, JSON.stringify(legacy));
    const state = await store.load('user-a', assert);
    expect(state.nodes).toEqual([node('user-a')]); expect(state.host.enabled).toBe(false); expect(state.host.token).not.toBe(legacy.host.token);
    expect(state.migration).toEqual({ pendingNodes: 1, hostPending: true });
    const bytes = await fs.readFile(legacyFile), magic = Buffer.from('SOFLIA-REMOTE-NODE-LEGACY-1\n');
    expect(bytes.subarray(0, magic.length)).toEqual(magic); expect(bytes.includes(Buffer.from(legacy.host.token))).toBe(false);
    expect(JSON.parse((await decrypt(bytes.subarray(magic.length))).result).state).toEqual(legacy);
    expect((await store.load('user-b', assert)).nodes).toEqual([node('user-b')]);
  });
  it('un perfil privado existente vacío gana sobre el legado', async () => {
    await store.load('user-a', assert);
    await fs.writeFile(path.join(root, 'remote-node-state.json'), JSON.stringify({ nodes: [node('user-a')] }));
    expect((await store.load('user-a', assert)).nodes).toEqual([]);
  });
  it.each([Buffer.alloc(0), Buffer.from('archivo dañado')])('archivo privado inválido no se reemplaza ni reimporta: %#', async bytes => {
    await store.load('user-a', assert); await fs.writeFile(file('user-a'), bytes);
    await fs.writeFile(path.join(root, 'remote-node-state.json'), JSON.stringify({ nodes: [node('user-a')] }));
    await expect(store.load('user-a', assert)).rejects.toThrow(); expect(await fs.readFile(file('user-a'))).toEqual(bytes);
  });
  it('llavero no disponible conserva legado plano sin crear fallback nuevo', async () => {
    const legacy = Buffer.from('{"host":{"token":"ficticio"}}'); const legacyFile = path.join(root, 'remote-node-state.json'); await fs.writeFile(legacyFile, legacy);
    available.mockResolvedValue(false);
    await expect(store.load('user-a', assert)).rejects.toBeInstanceOf(RemoteNodeStorageUnavailableError);
    expect(await fs.readFile(legacyFile)).toEqual(legacy); expect(await fs.readdir(root)).toEqual(['remote-node-state.json']);
  });
  it('cifrado fallido conserva el perfil anterior', async () => {
    const state = await store.load('user-a', assert), previous = await fs.readFile(file('user-a'));
    state.nodes.push(node('user-a')); encrypt.mockRejectedValueOnce(new Error('detalle privado ficticio'));
    await expect(store.save('user-a', state, assert)).rejects.toThrow('Se conservan'); expect(await fs.readFile(file('user-a'))).toEqual(previous);
  });
  it('fallo de reemplazo atómico no publica bytes ni deja temporales', async () => {
    const state = await store.load('user-a', assert), previous = await fs.readFile(file('user-a'));
    const failed = new RemoteNodeCredentialStore({ root: () => root, cipher: { available, encrypt, decrypt }, replace: async () => { throw new Error('ruta privada ficticia'); } });
    state.nodes.push(node('user-a')); await expect(failed.save('user-a', state, assert)).rejects.toThrow('Se conservan');
    expect(await fs.readFile(file('user-a'))).toEqual(previous); expect(await fs.readdir(path.dirname(file('user-a')))).toHaveLength(1);
  });
  it('rechaza propietario de nodo ajeno y cuota de 257 sin modificar disco', async () => {
    const state = await store.load('user-a', assert), previous = await fs.readFile(file('user-a'));
    state.nodes.push(node('user-b')); await expect(store.save('user-a', state, assert)).rejects.toThrow();
    state.nodes = Array.from({ length: 257 }, (_, index) => node('user-a', 'node-' + index)); await expect(store.save('user-a', state, assert)).rejects.toThrow();
    expect(await fs.readFile(file('user-a'))).toEqual(previous);
  });
  it('un legado inválido permanece intacto y no se convierte en defaults', async () => {
    const raw = Buffer.from('{json inválido'); const target = path.join(root, 'remote-node-state.json'); await fs.writeFile(target, raw);
    await expect(store.load('user-a', assert)).rejects.toThrow(); expect(await fs.readFile(target)).toEqual(raw);
  });
  it('un registro propio inválido queda en el archivo preservado y pendiente', async () => {
    await fs.writeFile(path.join(root, 'remote-node-state.json'), JSON.stringify({ nodes: [{ ...node('user-a'), token: null }] }));
    const state = await store.load('user-a', assert); expect(state.nodes).toEqual([]); expect(state.migration?.pendingNodes).toBe(1);
  });
  it('clona el payload antes de esperar y revalida antes del reemplazo', async () => {
    const state = await store.load('user-a', assert); state.nodes.push(node('user-a'));
    const pending = store.save('user-a', state, assert); state.nodes[0].token = 'cambio posterior'; await pending;
    expect((await store.load('user-a', assert)).nodes[0].token).toBe('credencial-ficticia-user-a');
    let current = true; encrypt.mockImplementationOnce(async () => { current = false; return Buffer.from('bytes ficticios'); });
    const prior = await fs.readFile(file('user-a'));
    await expect(store.save('user-a', state, () => { if (!current) throw new Error('Sesión vencida'); })).rejects.toThrow();
    expect(await fs.readFile(file('user-a'))).toEqual(prior);
  });
  it('una publicación ya admitida termina antes de cargar A de nuevo', async () => {
    const state = await store.load('user-a', assert); state.nodes.push(node('user-a'));
    let entered!: () => void, release!: () => void; const admitted = new Promise<void>(resolve => { entered = resolve; });
    const held = new Promise<void>(resolve => { release = resolve; }); let current = true;
    const queued = new RemoteNodeCredentialStore({ root: () => root, cipher: { available, encrypt, decrypt }, replace: async (...args) => {
      await replacePrivateFile(...args); entered(); await held;
    } });
    const oldSave = queued.save('user-a', state, () => { if (!current) throw new Error('Sesión antigua'); });
    const rejected = expect(oldSave).rejects.toThrow(); await admitted; current = false;
    let loaded = false; const reload = queued.load('user-a', assert).then(value => { loaded = true; return value; });
    await Promise.resolve(); expect(loaded).toBe(false); release(); await rejected;
    expect((await reload).nodes).toEqual(state.nodes);
  });
});
