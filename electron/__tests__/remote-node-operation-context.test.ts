import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RemoteNodeService } from '../remote-node/service';
import { buildDefaultState } from '../remote-node/state-utils';
import type { RemoteNodeDeps } from '../remote-node/types';
import { resetAuthStateForTests, setAuthState } from '../main/auth-state';

const ports = vi.hoisted(() => ({ load: vi.fn(), save: vi.fn(), sync: vi.fn() }));
vi.mock('../remote-node/state-store', () => ({ RemoteNodeCredentialStore: class {
  load() { return Promise.resolve(ports.load()); }
  save(_owner: string, state: unknown) { return Promise.resolve(ports.save(state)); }
} }));
vi.mock('../remote-node/host-server', () => ({ syncRemoteNodeServer: ports.sync }));
let service: RemoteNodeService;
const record = { id: 'node-1', name: 'Nodo de prueba', base_url: 'https://node.invalid', token: 'token-ficticio' };
beforeEach(async () => {
  resetAuthStateForTests(); setAuthState({ authenticated: true, userId: 'usuario-qa' });
  vi.restoreAllMocks(); ports.load.mockReset(); ports.save.mockReset(); ports.sync.mockReset().mockResolvedValue(null);
  const state = buildDefaultState(); state.host.enabled = false;
  ports.load.mockReturnValue(state); service = new RemoteNodeService();
  await service.initialize({} as RemoteNodeDeps); ports.sync.mockClear();
  await service.registerNode(record); await service.getHostStatus(); ports.sync.mockClear(); ports.save.mockClear();
});
afterEach(async () => { await service.dispose(); resetAuthStateForTests(); });
describe('Revisión ligada a la configuración main de nodos', () => {
  it.each(['registrar', 'eliminar', 'configurar'] as const)('invalida revisiones y señales tras %s', async action => {
    const review = await service.captureConfigurationReview({ assertCurrent: vi.fn() });
    review.assertCurrent(); expect(review.signal?.aborted).toBe(false);
    if (action === 'registrar') await service.registerNode({ ...record, token: 'otro-token-ficticio' });
    if (action === 'eliminar') await service.removeNode(record.id);
    if (action === 'configurar') await service.updateHostConfig({ node_name: 'Otro nombre' });
    expect(() => review.assertCurrent()).toThrow(); expect(review.signal?.aborted).toBe(true);
    await expect(service.openApplicationOnNode(record.id, { path: 'calculadora' }, review)).rejects.toThrow();
  });
  it('la mutación aprobada devuelve su resultado aunque invalide la revisión para usos futuros', async () => {
    const review = await service.captureConfigurationReview({ assertCurrent: vi.fn() });
    expect(await service.registerNode({ ...record, name: 'Nombre actualizado' }, review)).toMatchObject({ success: true, node: { name: 'Nombre actualizado' } });
    expect(() => review.assertCurrent()).toThrow();
  });
  it('una revisión inválida no guarda ni envía', async () => {
    const assertCurrent = vi.fn(() => { throw new Error('Sesión vencida'); });
    const fetch = vi.spyOn(globalThis, 'fetch');
    await expect(service.removeNode(record.id, { assertCurrent })).rejects.toThrow();
    expect(ports.save).not.toHaveBeenCalled(); expect(fetch).not.toHaveBeenCalled();
  });
  it('la salud no invalida configuración ni pierde capacidades futuras', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{"capabilities":["futura"]}'));
    const review = await service.captureConfigurationReview({ assertCurrent: vi.fn() });
    await service.testNode(record.id, review); review.assertCurrent();
    expect((await service.listNodes())[0].capabilities).toEqual(['futura']);
  });
  it('un cambio de token aborta HTTP en curso sin guardar metadata tardía', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch').mockImplementation(() => new Promise(() => undefined));
    const review = await service.captureConfigurationReview({ assertCurrent: vi.fn() });
    const pending = service.testNode(record.id, review); const rejected = expect(pending).rejects.toThrow();
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledOnce());
    await service.registerNode({ ...record, token: 'otro-token-ficticio' });
    const saves = ports.save.mock.calls.length;
    await rejected; expect(ports.save).toHaveBeenCalledTimes(saves);
    expect((await service.listNodes())[0].lastHealthAt).toBeNull();
  });
  it('serializa cambios de servidor y converge a la última configuración', async () => {
    let release!: (value: null) => void;
    ports.sync.mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
    const first = service.updateHostConfig({ port: 47826 });
    const second = service.updateHostConfig({ port: 47827 });
    await vi.waitFor(() => expect(ports.sync).toHaveBeenCalledOnce());
    await vi.waitFor(() => expect(ports.save).toHaveBeenCalledTimes(2));
    release(null); await Promise.all([first, second]);
    expect(ports.sync).toHaveBeenCalledTimes(2);
    expect(await service.getHostStatus()).toMatchObject({ port: 47827 });
  });
});
