import { useEffect } from 'react';
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useRemoteNodeData } from '../../components/ops/automation-ops-panel/useRemoteNodeData';
import type { RemoteNodeHostStatus } from '../../shared/remote-node';
import { useRemoteNodeForm } from '../../components/ops/automation-ops-panel/useRemoteNodeForm';
const ports = vi.hoisted(() => ({ status: vi.fn(), nodes: vi.fn() }));
vi.mock('../../services/remote-node-service', () => ({ getRemoteNodeHostStatus: ports.status, listRemoteNodes: ports.nodes }));
const host = (token: string): RemoteNodeHostStatus => ({ success: true, enabled: false, bind_address: '127.0.0.1', port: 47825, node_name: 'Host ficticio', advertise_url: null, local_url: 'http://127.0.0.1:47825', running: false, token, capabilities: [], registered_nodes: 0 });
const deferred = () => { let release!: (value: RemoteNodeHostStatus) => void; const promise = new Promise<RemoteNodeHostStatus>(resolve => { release = resolve; }); return { promise, release }; };
beforeEach(() => { ports.status.mockReset().mockResolvedValue(host('token-actual-ficticio')); ports.nodes.mockReset().mockResolvedValue({ success: true, nodes: [] }); });
describe('Caché renderer de nodos por identidad y revisión', () => {
  it('retira inmediatamente token de A al cambiar a B y niega setter anterior', async () => {
    const view = renderHook(({ owner }) => useRemoteNodeData(owner), { initialProps: { owner: 'a' } });
    await act(async () => { await view.result.current.refresh(); });
    const oldSetter = view.result.current.setHostStatus;
    expect(view.result.current.hostStatus?.token).toBe('token-actual-ficticio');
    view.rerender({ owner: 'b' }); expect(view.result.current.hostStatus).toBeNull();
    act(() => oldSetter(host('token-anterior'))); expect(view.result.current.hostStatus).toBeNull();
  });
  it('respuesta tardía A no reemplaza B', async () => {
    const old = deferred(); ports.status.mockReturnValueOnce(old.promise);
    const view = renderHook(({ owner }) => useRemoteNodeData(owner), { initialProps: { owner: 'a' } });
    let pending!: Promise<void>; act(() => { pending = view.result.current.refresh(); });
    view.rerender({ owner: 'b' }); await act(async () => { await view.result.current.refresh(); });
    await act(async () => { old.release(host('token-de-a')); await pending; });
    expect(view.result.current.hostStatus?.token).toBe('token-actual-ficticio');
  });
  it('A/B/A conserva la nueva revisión y rechaza respuesta/setter de A anterior', async () => {
    const old = deferred(); ports.status.mockReturnValueOnce(old.promise);
    const view = renderHook(({ owner }) => useRemoteNodeData(owner), { initialProps: { owner: 'a' } });
    const oldSetter = view.result.current.setHostStatus; let pending!: Promise<void>;
    act(() => { pending = view.result.current.refresh(); }); view.rerender({ owner: 'b' }); view.rerender({ owner: 'a' });
    await act(async () => { await view.result.current.refresh(); old.release(host('token-antiguo-a')); await pending; });
    act(() => oldSetter(host('otro-token-antiguo'))); expect(view.result.current.hostStatus?.token).toBe('token-actual-ficticio');
  });
  it('StrictMode no readmite la respuesta del primer efecto desmontado', async () => {
    const first = deferred(), second = deferred(); ports.status.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const view = renderHook(() => { const data = useRemoteNodeData('a'); const refresh = data.refresh; useEffect(() => { void refresh(); }, [refresh]); return data; }, { reactStrictMode: true });
    expect(ports.status).toHaveBeenCalledTimes(2);
    await act(async () => { second.release(host('token-segundo')); });
    await act(async () => { first.release(host('token-primero-obsoleto')); });
    expect(view.result.current.hostStatus?.token).toBe('token-segundo');
  });
  it('sin identidad no consulta IPC ni publica token', async () => {
    const view = renderHook(() => useRemoteNodeData('')); await act(async () => { await view.result.current.refresh(); });
    expect(ports.status).not.toHaveBeenCalled(); expect(view.result.current.hostStatus).toBeNull();
  });
  it('el borrador y la captura de A se retiran al cambiar a B, incluido A/B/A', () => {
    const view = renderHook(({ owner }) => useRemoteNodeForm(owner), { initialProps: { owner: 'a' } });
    act(() => { view.result.current.setToken('token-borrador-a'); view.result.current.setImage({ nodeId: 'a', image: 'imagen-ficticia', capturedAt: '2026-10-26' }); });
    const old = view.result.current;
    view.rerender({ owner: 'b' }); expect(view.result.current.token).toBe(''); expect(view.result.current.image).toBeNull();
    view.rerender({ owner: 'a' }); act(() => { old.setToken('token-tardío'); old.setImage(old.image); });
    expect(view.result.current.token).toBe(''); expect(view.result.current.image).toBeNull();
    act(() => view.result.current.setName(previous => previous + 'Nodo actual'));
    expect(view.result.current.name).toBe('Nodo actual');
  });
  it('el borrador sin identidad permanece vacío', () => {
    const view = renderHook(() => useRemoteNodeForm(''));
    act(() => view.result.current.setToken('token-ficticio')); expect(view.result.current.token).toBe('');
  });
});
