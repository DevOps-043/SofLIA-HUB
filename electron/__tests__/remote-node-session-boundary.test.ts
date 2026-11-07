import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RemoteNodeService } from '../remote-node/service';
import { buildDefaultState } from '../remote-node/state-utils';
import { resetAuthStateForTests, setAuthState } from '../main/auth-state';
import type { RemoteNodeDeps } from '../remote-node/types';
const ports = vi.hoisted(() => ({ load: vi.fn(), save: vi.fn(), sync: vi.fn() }));
vi.mock('../remote-node/state-store', () => ({
  loadRemoteNodeState: ports.load, saveRemoteNodeState: ports.save,
  RemoteNodeCredentialStore: class {
    load(owner: string, assert: () => void) { assert(); return Promise.resolve(ports.load(owner)); }
    save(owner: string, state: unknown, assert: () => void) { assert(); return Promise.resolve(ports.save(state, owner)); }
  },
}));
vi.mock('../remote-node/host-server', () => ({ syncRemoteNodeServer: ports.sync }));
let service: RemoteNodeService;
const login = (userId: string) => setAuthState({ authenticated: true, userId });
const state = () => { const value = buildDefaultState(); value.host.enabled = false; return value; };
beforeEach(() => {
  resetAuthStateForTests(); ports.load.mockReset(); ports.save.mockReset(); ports.sync.mockReset().mockResolvedValue(null);
  const legacy = state(); legacy.nodes.push({ id: 'node-a', name: 'Nodo A', baseUrl: 'https://node.invalid', token: 'token-a-ficticio', enabled: true, owner_user_id: 'user-a', createdAt: '2026-10-26', updatedAt: '2026-10-26' });
  ports.load.mockImplementation((owner?: string) => owner === 'user-b' ? state() : structuredClone(legacy));
  service = new RemoteNodeService();
});
afterEach(async () => { await service.dispose(); resetAuthStateForTests(); vi.restoreAllMocks(); });
describe('Frontera de sesión y confirmación de persistencia del servicio remoto', () => {
  it('no lee credenciales ni inicia host sin sesión', async () => {
    await service.initialize({} as RemoteNodeDeps);
    expect(ports.load).not.toHaveBeenCalled();
    await expect(service.listNodes()).rejects.toThrow();
  });
  it('B no recibe nodos ni token del perfil A', async () => {
    login('user-a'); await service.initialize({} as RemoteNodeDeps);
    expect(await service.listNodes()).toHaveLength(1);
    login('user-b'); expect(await service.listNodes()).toEqual([]);
  });
  it('logout niega lecturas y una revisión A/B/A no recupera autoridad', async () => {
    login('user-a'); await service.initialize({} as RemoteNodeDeps);
    const review = await service.captureConfigurationReview({ assertCurrent: vi.fn() });
    login('user-b'); login('user-a');
    expect(() => review.assertCurrent()).toThrow();
    setAuthState({ authenticated: false, userId: null });
    await expect(service.getHostStatus()).rejects.toThrow();
  });
  it('guardar host fallido conserva RAM anterior', async () => {
    login('user-a'); await service.initialize({} as RemoteNodeDeps);
    ports.save.mockImplementationOnce(() => { throw new Error('Fallo de disco ficticio'); });
    await expect(service.updateHostConfig({ enabled: true })).rejects.toThrow();
    expect(await service.getHostStatus()).toMatchObject({ enabled: false });
  });
  it('registro fallido no publica un nodo que no fue guardado', async () => {
    login('user-a'); await service.initialize({} as RemoteNodeDeps);
    ports.save.mockImplementationOnce(() => { throw new Error('Fallo de disco ficticio'); });
    await expect(service.registerNode({ id: 'new-node', name: 'Nuevo', base_url: 'https://nuevo.invalid', token: 'ficticio' })).rejects.toThrow();
    expect((await service.listNodes()).map(node => node.id)).toEqual(['node-a']);
  });
  it('no confirma registro mientras el guardado siga pendiente', async () => {
    login('user-a'); await service.initialize({} as RemoteNodeDeps);
    let release!: () => void;
    ports.save.mockImplementationOnce(() => new Promise<void>(resolve => { release = resolve; }));
    let finished = false;
    const pending = service.registerNode({ name: 'Nuevo', base_url: 'https://nuevo.invalid', token: 'ficticio' }).then(() => { finished = true; });
    try { for (let index = 0; index < 8; index++) await Promise.resolve(); expect(finished).toBe(false); }
    finally { release?.(); await pending; }
  });
  it('carga A tardía no reemplaza a B después del cambio de cuenta', async () => {
    login('user-a'); let release!: (value: ReturnType<typeof state>) => void;
    ports.load.mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
    const old = service.initialize({} as RemoteNodeDeps); const rejected = expect(old).rejects.toThrow();
    login('user-b'); expect(await service.listNodes()).toEqual([]);
    release(state()); await rejected; expect(await service.listNodes()).toEqual([]);
  });
  it('fallo al guardar salud no publica metadata que no fue persistida', async () => {
    login('user-a'); await service.initialize({} as RemoteNodeDeps);
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{"capabilities":["nueva"]}'));
    ports.save.mockImplementationOnce(() => { throw new Error('Fallo ficticio de guardado'); });
    await expect(service.testNode('node-a')).rejects.toThrow();
    const [node] = await service.listNodes(); expect(node.lastHealthAt).toBeUndefined(); expect(node.capabilities).toBeUndefined();
  });
});
