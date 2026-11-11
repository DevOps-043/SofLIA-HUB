import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type BrowserWindow, type IpcMainInvokeEvent } from 'electron';
import { authSourceFixture } from './helpers/auth-source.fixture';
import { rendererSource } from '../ipc/renderer-source';
import { isAppDocument, trustedAppCaller, trustedAppWindow } from '../ipc/caller-authorization';
import { resetAuthStateForTests, setAuthState } from '../main/auth-state';

let hub: ReturnType<typeof authSourceFixture>;
let current: BrowserWindow | null;
beforeEach(() => { resetAuthStateForTests(); hub = authSourceFixture(); current = hub.window; });
afterEach(() => { resetAuthStateForTests(); vi.unstubAllEnvs(); });
const source = () => rendererSource(hub.event.sender, hub.event.senderFrame, () => [current]);

describe('Lease nativa de fuente renderer', () => {
  it('no exige sesión y libera exactamente sus listeners de forma idempotente', () => {
    const unrelated = vi.fn(); hub.sender.on('destroyed', unrelated);
    const lease = source(); expect(() => lease.assert()).not.toThrow();
    expect(hub.sender.listenerCount('did-start-navigation')).toBe(1);
    lease.dispose(); lease.dispose();
    expect(lease.signal.aborted).toBe(true); expect(() => lease.assert()).toThrow('context_invalid');
    expect(hub.sender.eventNames()).toEqual(['destroyed']); expect(hub.sender.listeners('destroyed')).toEqual([unrelated]);
  });

  it.each(['legacy', 'detalle', 'in-page'])('navegación de subframe no invalida el principal: %s', mode => {
    const lease = source();
    if (mode === 'legacy') hub.sender.emit('did-start-navigation', {}, 'https://subframe.example.invalid/', false, false);
    if (mode === 'detalle') hub.sender.emit('did-start-navigation', { isMainFrame: false });
    if (mode === 'in-page') hub.sender.emit('did-navigate-in-page', {}, hub.frame.url, false);
    expect(() => lease.assert()).not.toThrow(); expect(lease.signal.aborted).toBe(false); lease.dispose();
  });

  it.each(['in-page-legacy', 'sin-detalle', 'detached', 'reemplazo'])('invalida fuente y no recupera una lease antigua: %s', mode => {
    const lease = source();
    if (mode === 'in-page-legacy') hub.sender.emit('did-navigate-in-page', {}, hub.frame.url, true);
    if (mode === 'sin-detalle') hub.sender.emit('did-start-navigation', {});
    if (mode === 'detached') hub.frame.detached = true;
    if (mode === 'reemplazo') current = authSourceFixture().window;
    expect(() => lease.assert()).toThrow('context_invalid');
    lease.dispose(); expect(hub.sender.eventNames()).toEqual([]);
  });

  it('el documento propio admite query/hash pero rechaza rutas, hosts y credenciales ajenas', () => {
    expect(isAppDocument(hub.frame.url + '?view=orb#inicio')).toBe(true);
    expect(isAppDocument(hub.frame.url + '/otro')).toBe(false); expect(isAppDocument('no-url')).toBe(false);
    vi.stubEnv('VITE_DEV_SERVER_URL', 'http://localhost:5173/');
    expect(isAppDocument('http://localhost:5173/?view=orb')).toBe(true);
    for (const url of ['http://localhost:5174/', 'http://localhost:5173/otro', 'https://localhost:5173/', 'http://usuario:clave@localhost:5173/', 'http://externo.example.invalid:5173/']) expect(isAppDocument(url)).toBe(false);
  });
});

describe('Composición con identidad autenticada', () => {
  it('la extracción no permite usar consumidores autenticados sin sesión', () => {
    const lease = trustedAppCaller(hub.event, () => [current]);
    expect(() => lease.assert()).toThrow('context_invalid'); lease.dispose(); expect(hub.sender.eventNames()).toEqual([]);
  });

  it.each(['otra', 'salida', 'ABA', 'navegacion'])('invalida identidad por %s y conserva cancelación', mode => {
    setAuthState({ authenticated: true, userId: 'uno' });
    const lease = trustedAppCaller(hub.event, () => [current]);
    expect(() => lease.assert()).not.toThrow();
    if (mode === 'otra') setAuthState({ authenticated: true, userId: 'dos' });
    if (mode === 'salida' || mode === 'ABA') setAuthState({ authenticated: false, userId: null });
    if (mode === 'ABA') setAuthState({ authenticated: true, userId: 'uno' });
    if (mode === 'navegacion') hub.sender.emit('did-start-navigation', { isMainFrame: true });
    expect(lease.signal.aborted).toBe(true); expect(() => lease.assert()).toThrow('context_invalid');
    lease.dispose(); expect(hub.sender.eventNames()).toEqual([]);
  });

  it('main usa la ventana registrada y mantiene comprobación de identidad', () => {
    setAuthState({ authenticated: true, userId: 'uno' });
    const lease = trustedAppWindow(() => [current]);
    expect(lease.parent).toBe(hub.window); expect(lease.userId).toBe('uno'); expect(() => lease.assert()).not.toThrow();
    lease.dispose(); current = null; expect(() => trustedAppWindow(() => [current])).toThrow('context_invalid');
  });

  it('un subframe con el mismo URL no adquiere autorización', () => {
    setAuthState({ authenticated: true, userId: 'uno' });
    const event = { ...hub.event, senderFrame: { ...hub.frame } } as IpcMainInvokeEvent;
    const lease = trustedAppCaller(event, () => [current]);
    expect(() => lease.assert()).toThrow('context_invalid'); lease.dispose(); expect(hub.sender.eventNames()).toEqual([]);
  });
});
