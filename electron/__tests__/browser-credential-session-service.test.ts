import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BrowserWindow } from 'electron';
import { IntegratedBrowserService } from '../integrated-browser/service';
import type { BrowserCredentialVault } from '../integrated-browser/credential-vault';
import { resetBrowserScopeForTests } from '../integrated-browser/profile-scope';
const verify = vi.hoisted(() => vi.fn<(parent: unknown, signal: AbortSignal) => Promise<boolean>>(async () => true));
vi.mock('../integrated-browser/credential-unlock', async original => {
  const actual = await original<typeof import('../integrated-browser/credential-unlock')>();
  return { ...actual, BrowserCredentialUnlock: class extends actual.BrowserCredentialUnlock {
    constructor(changed: () => void) { super(changed, verify); }
  } };
});
let browser: IntegratedBrowserService;
let vault: { list: ReturnType<typeof vi.fn>; getAutosaveEnabled: ReturnType<typeof vi.fn>; flush: ReturnType<typeof vi.fn>; prepareRecovery: ReturnType<typeof vi.fn> };
beforeEach(() => {
  verify.mockReset().mockResolvedValue(true); resetBrowserScopeForTests();
  vault = { list: vi.fn(async () => []), getAutosaveEnabled: vi.fn(async () => false), flush: vi.fn(async () => {}), prepareRecovery: vi.fn() };
  browser = new IntegratedBrowserService(undefined, vault as unknown as BrowserCredentialVault);
  browser.attachWindow(new BrowserWindow());
});
afterEach(() => { browser.detachWindow(); vi.restoreAllMocks(); resetBrowserScopeForTests(); });
const request = (action: 'unlock' | 'lock' | 'status') => ({ action, profileRevision: browser.getState().profileRevision! });
describe('bóveda integrada y autorización SO', () => {
  it('no lee el archivo al abrir la ventana y rechaza operaciones bloqueadas', async () => {
    await Promise.resolve(); expect(vault.getAutosaveEnabled).not.toHaveBeenCalled();
    expect(await browser.credentialSessionCommand(request('status'))).toMatchObject({ success: true, unlocked: false });
    for (const operation of [() => browser.listCredentials(), () => browser.analyzeCredentialHealth(),
      () => browser.importCredentials(), () => browser.exportCredentials(), () => browser.recoverCredentials(),
      () => browser.saveCredential({ username: 'ficticio', password: 'ficticia', expectedOrigin: 'https://example.com' }), () => browser.removeCredential('ficticio'),
      () => browser.clearBrowsingData({ categories: ['contrasenas'], range: 'todo' })]) {
      await expect(Promise.resolve().then(async () => { await operation(); })).rejects.toThrow('bloqueada');
    }
    expect(vault.list).not.toHaveBeenCalled(); expect(vault.prepareRecovery).not.toHaveBeenCalled();
  });
  it('la verificación carga preferencias y el bloqueo revoca el estado', async () => {
    expect(await browser.credentialSessionCommand(request('unlock'))).toMatchObject({ unlocked: true });
    expect(vault.getAutosaveEnabled).toHaveBeenCalledTimes(1);
    expect(browser.getState().credentialUnlocked).toBe(true);
    expect(await browser.credentialSessionCommand(request('lock'))).toMatchObject({ unlocked: false });
    await expect(browser.recoverCredentials()).rejects.toThrow('bloqueada');
  });
  it.each(['cancelar', 'bloquear', 'cerrar', 'emisor'])('no autoriza una verificación invalidada: %s', async mode => {
    let valid = true;
    verify.mockImplementationOnce(async () => {
      if (mode === 'bloquear') browser.lockCredentials();
      if (mode === 'cerrar') browser.detachWindow();
      if (mode === 'emisor') valid = false;
      return mode !== 'cancelar';
    });
    const result = browser.credentialSessionCommand(request('unlock'), () => { if (!valid) throw new Error('Emisor inválido'); });
    if (mode === 'cerrar' || mode === 'emisor') await expect(result).rejects.toThrow();
    else expect(await result).toMatchObject({ success: false, unlocked: false });
    expect(browser.getState().credentialUnlocked).toBe(false);
    expect(vault.getAutosaveEnabled).not.toHaveBeenCalled();
  });
});
