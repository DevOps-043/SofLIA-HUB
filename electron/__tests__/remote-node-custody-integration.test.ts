import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dialog, ipcMain, type IpcMainInvokeEvent } from 'electron';
import { authSourceFixture } from './helpers/auth-source.fixture';
import { remoteNodeService } from '../remote-node-service';
import { registerRemoteNodeHandlers } from '../remote-node-handlers';
import { exposeRemoteApis } from '../preload/remote-apis';
import { createSafeIpc } from '../preload/safe-ipc';
import { registerRemoteNode, listRemoteNodes, getRemoteNodeHostStatus } from '../../src/services/remote-node-service';
import { resetAuthStateForTests, setAuthState } from '../main/auth-state';
import type { RemoteNodeApi } from '../../src/shared/remote-node';
import type { RemoteNodeDeps } from '../remote-node/types';
import type { OsCipher } from '../storage/os-cipher';

const ports = vi.hoisted(() => ({ root: '', cipher: null as OsCipher | null, fail: false, hold: null as Promise<void> | null, started: null as (() => void) | null, sync: vi.fn() }));
vi.mock('../remote-node/state-store', async () => {
  const actual = await vi.importActual<typeof import('../remote-node/state-store')>('../remote-node/state-store');
  const files = await vi.importActual<typeof import('../storage/private-files')>('../storage/private-files');
  return { ...actual, RemoteNodeCredentialStore: class extends actual.RemoteNodeCredentialStore {
    constructor() { super({ root: () => ports.root, cipher: {
      available: () => ports.cipher!.available(), decrypt: value => ports.cipher!.decrypt(value), encrypt: async value => {
        if (ports.hold) { ports.started?.(); await ports.hold; } return ports.cipher!.encrypt(value);
      },
    }, replace: async (...args) => { if (ports.fail) throw new Error('Ruta privada ficticia'); return files.replacePrivateFile(...args); } }); }
  } };
});
vi.mock('../remote-node/host-server', () => ({ syncRemoteNodeServer: ports.sync }));
const ipc = ipcMain as unknown as { _clearHandlers(): void; _getHandler(channel: string): (event: IpcMainInvokeEvent, ...args: unknown[]) => Promise<unknown> };
let hub: ReturnType<typeof authSourceFixture>;
beforeEach(async () => {
  ports.root = await fs.mkdtemp(path.join(os.tmpdir(), 'soflia-custody-integration-')); ports.fail = false; ports.hold = null; ports.started = null;
  ports.sync.mockReset().mockResolvedValue(null); resetAuthStateForTests(); ipc._clearHandlers();
  const key = randomBytes(32);
  ports.cipher = {
    available: async () => true,
    encrypt: async text => { const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', key, iv); const body = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]); return Buffer.concat([iv, cipher.getAuthTag(), body]); },
    decrypt: async bytes => { const cipher = createDecipheriv('aes-256-gcm', key, bytes.subarray(0, 12)); cipher.setAuthTag(bytes.subarray(12, 28)); return { result: Buffer.concat([cipher.update(bytes.subarray(28)), cipher.final()]).toString('utf8'), shouldReEncrypt: false }; },
  };
  setAuthState({ authenticated: true, userId: 'user-a' }); await remoteNodeService.initialize({} as RemoteNodeDeps);
  hub = authSourceFixture(); registerRemoteNodeHandlers(() => hub.window);
  vi.mocked(dialog.showMessageBox).mockResolvedValue({ response: 1, checkboxChecked: false });
  let api: RemoteNodeApi | undefined;
  const invoke = (channel: string, ...args: unknown[]) => ipc._getHandler(channel)(hub.event, ...args);
  exposeRemoteApis({ exposeInMainWorld: (name, value) => { if (name === 'remoteNode') api = value as RemoteNodeApi; } }, createSafeIpc({ invoke, send: vi.fn(), on: vi.fn(), off: vi.fn(), removeAllListeners: vi.fn() }));
  vi.stubGlobal('window', { remoteNode: api });
});
afterEach(async () => {
  ports.hold = null; await remoteNodeService.dispose(); resetAuthStateForTests(); vi.unstubAllGlobals(); vi.restoreAllMocks();
  const root = path.resolve(ports.root);
  if (path.dirname(root) !== path.resolve(os.tmpdir()) || !path.basename(root).startsWith('soflia-custody-integration-')) throw new Error('Ruta de limpieza inválida.');
  await fs.rm(root, { recursive: true, force: true });
});
const input = { id: 'node-a', name: 'Nodo A ficticio', base_url: 'https://node.invalid', token: 'credencial-ficticia-de-a' };
describe('Custodia integrada: wrapper/preload/IPC/servicio/archivo cifrado', () => {
  it('restaura A/B/A sin exponer los nodos ni token de otra cuenta', async () => {
    expect(await registerRemoteNode(input)).toMatchObject({ success: true, node: { owner_user_id: 'user-a' } });
    const hostA = await getRemoteNodeHostStatus();
    setAuthState({ authenticated: true, userId: 'user-b' });
    expect(await listRemoteNodes()).toMatchObject({ success: true, nodes: [] });
    expect((await getRemoteNodeHostStatus()).token).not.toBe(hostA.token);
    setAuthState({ authenticated: true, userId: 'user-a' });
    expect(await listRemoteNodes()).toMatchObject({ nodes: [{ id: input.id, token: input.token }] });
    for (const name of await fs.readdir(path.join(ports.root, 'remote-node-credentials'))) {
      const bytes = await fs.readFile(path.join(ports.root, 'remote-node-credentials', name)); expect(bytes.includes(Buffer.from(input.token))).toBe(false);
    }
  });
  it('el fallo de disco produce error seguro y conserva el estado anterior', async () => {
    ports.fail = true; const result = await registerRemoteNode(input); ports.fail = false;
    expect(result).toMatchObject({ success: false, uncertain: true }); expect(JSON.stringify(result)).not.toContain('Ruta privada');
    expect(await listRemoteNodes()).toMatchObject({ nodes: [] });
  });
  it('logout durante cifrado no publica el registro bajo la cuenta siguiente', async () => {
    let release!: () => void, started!: () => void;
    ports.hold = new Promise<void>(resolve => { release = resolve; }); const admitted = new Promise<void>(resolve => { started = resolve; }); ports.started = started;
    const old = registerRemoteNode(input); await admitted;
    setAuthState({ authenticated: true, userId: 'user-b' }); ports.hold = null; release();
    expect(await old).toMatchObject({ success: false }); expect(await listRemoteNodes()).toMatchObject({ nodes: [] });
    setAuthState({ authenticated: true, userId: 'user-a' }); expect(await listRemoteNodes()).toMatchObject({ nodes: [] });
  });
  it('no acepta un propietario enviado por renderer que no coincide con main', async () => {
    const result = await registerRemoteNode({ ...input, owner_user_id: 'user-b' }); expect(result.success).toBe(false);
    expect(await listRemoteNodes()).toMatchObject({ nodes: [] });
  });
});
