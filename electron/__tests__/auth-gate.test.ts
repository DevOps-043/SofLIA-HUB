import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getAuthState,
  isAuthenticated,
  onAuthStateChange,
  resetAuthStateForTests,
  setAuthState,
} from '../main/auth-state';
import { canUseProtectedFeature, denyIfUnauthenticated, AUTH_REQUIRED } from '../main/require-auth';
import { registerWhatsAppAuthGate } from '../main/whatsapp-auth-gate';

describe('estado de auth del proceso main', () => {
  beforeEach(() => {
    resetAuthStateForTests();
    delete process.env.SOFLIA_DISABLE_AUTH_GATE;
  });

  afterEach(() => {
    delete process.env.SOFLIA_DISABLE_AUTH_GATE;
  });

  it('AUTHGATE-001: arranca negado por defecto', () => {
    expect(isAuthenticated()).toBe(false);
    expect(getAuthState()).toEqual({ authenticated: false, userId: null });
  });

  it('AUTHGATE-002: publicar una sesion habilita el acceso', () => {
    setAuthState({ authenticated: true, userId: 'user-1' });

    expect(isAuthenticated()).toBe(true);
    expect(getAuthState().userId).toBe('user-1');
  });

  it('AUTHGATE-003: no conserva userId cuando no hay sesion', () => {
    setAuthState({ authenticated: false, userId: 'user-1' });

    expect(getAuthState()).toEqual({ authenticated: false, userId: null });
  });

  it('AUTHGATE-004: notifica a los suscriptores solo cuando el estado cambia', () => {
    const listener = vi.fn();
    onAuthStateChange(listener);

    setAuthState({ authenticated: true, userId: 'user-1' });
    setAuthState({ authenticated: true, userId: 'user-1' });
    setAuthState({ authenticated: false, userId: null });

    expect(listener).toHaveBeenCalledTimes(2);
    expect(listener).toHaveBeenLastCalledWith({ authenticated: false, userId: null });
  });
});

describe('guard de funciones protegidas', () => {
  beforeEach(() => {
    resetAuthStateForTests();
    delete process.env.SOFLIA_DISABLE_AUTH_GATE;
  });

  afterEach(() => {
    delete process.env.SOFLIA_DISABLE_AUTH_GATE;
  });

  it('AUTHGATE-005: deniega sin sesion y devuelve auth_required sin efectos', () => {
    const resultado = denyIfUnauthenticated('orbe');

    expect(canUseProtectedFeature()).toBe(false);
    expect(resultado).not.toBeNull();
    expect(resultado?.error).toBe(AUTH_REQUIRED);
  });

  it('AUTHGATE-006: permite con sesion valida', () => {
    setAuthState({ authenticated: true, userId: 'user-1' });

    expect(canUseProtectedFeature()).toBe(true);
    expect(denyIfUnauthenticated('orbe')).toBeNull();
  });

  it('AUTHGATE-007: revoca el acceso al cerrar sesion', () => {
    setAuthState({ authenticated: true, userId: 'user-1' });
    setAuthState({ authenticated: false, userId: null });

    expect(canUseProtectedFeature()).toBe(false);
    expect(denyIfUnauthenticated('whatsapp')?.error).toBe(AUTH_REQUIRED);
  });

  it('AUTHGATE-008: la bandera de reversion restablece el comportamiento previo', () => {
    process.env.SOFLIA_DISABLE_AUTH_GATE = '1';

    expect(isAuthenticated()).toBe(false);
    expect(canUseProtectedFeature()).toBe(true);
    expect(denyIfUnauthenticated('orbe')).toBeNull();
  });
});

describe('autoconexion de WhatsApp ligada a la sesion', () => {
  function createWaPort(overrides: Partial<Record<string, unknown>> = {}) {
    return {
      shouldAutoConnect: vi.fn(async () => true),
      getSavedApiKey: vi.fn(async () => 'api-key'),
      connect: vi.fn(async () => undefined),
      disconnect: vi.fn(async () => undefined),
      ...overrides,
    };
  }

  beforeEach(() => {
    resetAuthStateForTests();
    delete process.env.SOFLIA_DISABLE_AUTH_GATE;
  });

  it('AUTHGATE-009: al iniciar sesion reintenta la autoconexion con la API key guardada', async () => {
    const waService = createWaPort();
    const initWhatsAppAgent = vi.fn();
    registerWhatsAppAuthGate({ waService, initWhatsAppAgent });

    setAuthState({ authenticated: true, userId: 'user-1' });

    await vi.waitFor(() => expect(waService.connect).toHaveBeenCalledTimes(1));
    expect(initWhatsAppAgent).toHaveBeenCalledWith('api-key');
  });

  it('AUTHGATE-010: al cerrar sesion desconecta WhatsApp', async () => {
    const waService = createWaPort();
    registerWhatsAppAuthGate({ waService, initWhatsAppAgent: vi.fn() });

    setAuthState({ authenticated: true, userId: 'user-1' });
    await vi.waitFor(() => expect(waService.connect).toHaveBeenCalled());
    setAuthState({ authenticated: false, userId: null });

    await vi.waitFor(() => expect(waService.disconnect).toHaveBeenCalledTimes(1));
  });

  it('AUTHGATE-011: respeta shouldAutoConnect=false y no conecta', async () => {
    const waService = createWaPort({ shouldAutoConnect: vi.fn(async () => false) });
    registerWhatsAppAuthGate({ waService, initWhatsAppAgent: vi.fn() });

    setAuthState({ authenticated: true, userId: 'user-1' });

    await vi.waitFor(() => expect(waService.shouldAutoConnect).toHaveBeenCalled());
    expect(waService.connect).not.toHaveBeenCalled();
  });
});
