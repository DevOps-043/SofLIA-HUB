import { afterEach, describe, expect, it, vi } from 'vitest';
import { projectHubApi } from '../../services/project-hub-api';
import { publishAuthState, waitForAuthStatePublication } from '../../services/auth-state';

const authenticated = { authenticated: true, userId: 'usuario-prueba' };
afterEach(() => {
  delete (window as Window & { authState?: unknown }).authState;
  delete (window as Window & { projectHubApi?: unknown }).projectHubApi;
  vi.useRealTimers();
});

describe('Orden de sesión y lecturas iniciales', () => {
  it('espera la obtención del token y la confirmación de main antes de consultar proyectos', async () => {
    let tokenReady!: (value: typeof authenticated) => void;
    let mainReady!: (value: unknown) => void;
    const setState = vi.fn(() => new Promise(resolve => { mainReady = resolve; }));
    const getStatus = vi.fn().mockResolvedValue({ success: true });
    Object.assign(window, { authState: { setState }, projectHubApi: { getStatus } });
    const publication = publishAuthState(() => new Promise(resolve => { tokenReady = resolve; }));
    const status = projectHubApi.status();
    expect(getStatus).not.toHaveBeenCalled();
    tokenReady(authenticated);
    await Promise.resolve();
    expect(setState).toHaveBeenCalledWith(authenticated);
    expect(getStatus).not.toHaveBeenCalled();
    mainReady({ ok: true, state: authenticated });
    await publication;
    expect(await status).toEqual({ success: true });
  });

  it('acota la espera y permite recuperarse cuando main termina', async () => {
    vi.useFakeTimers();
    let finish!: (value: unknown) => void;
    const setState = vi.fn(() => new Promise(resolve => { finish = resolve; }));
    const getStatus = vi.fn().mockResolvedValue({ success: true });
    Object.assign(window, { authState: { setState }, projectHubApi: { getStatus } });
    const publication = publishAuthState(authenticated);
    const status = projectHubApi.status();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(await status).toMatchObject({ success: false, code: 'SOFIA_SESSION_PENDING' });
    expect(getStatus).not.toHaveBeenCalled();
    finish({ ok: true, state: authenticated });
    await publication;
    expect(await projectHubApi.status()).toEqual({ success: true });
    expect(vi.getTimerCount()).toBe(0);
  });

  it('no retiene el cierre de sesión detrás de una publicación lenta', async () => {
    let finish!: (value: unknown) => void;
    const setState = vi.fn().mockImplementationOnce(() => new Promise(resolve => { finish = resolve; })).mockResolvedValue({ ok: true });
    Object.assign(window, { authState: { setState } });
    const slow = publishAuthState(authenticated);
    await publishAuthState({ authenticated: false, userId: null });
    expect(setState).toHaveBeenLastCalledWith({ authenticated: false, userId: null });
    finish({ ok: true });
    await slow;
    expect(await waitForAuthStatePublication()).toBe(true);
  });

  it('un rechazo no habilita acceso ni oculta el error del guard de main', async () => {
    const getStatus = vi.fn().mockResolvedValue({ success: false, code: 'IPC_DENIED' });
    Object.assign(window, { authState: { setState: vi.fn().mockRejectedValue(new Error('Sin conexión')) }, projectHubApi: { getStatus } });
    await publishAuthState(authenticated);
    expect(await projectHubApi.status()).toMatchObject({ success: false, code: 'IPC_DENIED' });
  });
});
