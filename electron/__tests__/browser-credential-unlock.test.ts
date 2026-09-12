import { afterEach, describe, expect, it, vi } from 'vitest';
import type { BrowserWindow } from 'electron';
import { performance } from 'node:perf_hooks';
import { BrowserCredentialUnlock, CREDENTIAL_UNLOCK_MS } from '../integrated-browser/credential-unlock';
import { windowsHelloScript } from '../integrated-browser/windows-hello-source';
import { validateCredentialSessionRequest } from '../../src/shared/browser-credential-session';

const parent = {} as BrowserWindow;
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });
describe('sesión SO de la bóveda', () => {
  it('inicia bloqueada y sólo autoriza una verificación positiva', async () => {
    const verify = vi.fn(async () => false); const gate = new BrowserCredentialUnlock(vi.fn(), verify);
    expect(() => gate.capture()).toThrow('bloqueada');
    expect(await gate.unlock(parent, () => {})).toBe(false); expect(gate.isUnlocked()).toBe(false);
    verify.mockResolvedValue(true); expect(await gate.unlock(parent, () => {})).toBe(true);
    const guard = gate.capture(); expect(guard).not.toThrow();
    gate.lock(); expect(guard).toThrow('bloqueada');
    await gate.unlock(parent, () => {}); expect(guard).toThrow('bloqueada'); gate.lock();
  });
  it('caduca por reloj monotónico y por temporizador, sin extenderse al leer', async () => {
    vi.useFakeTimers(); let time = 10; vi.spyOn(performance, 'now').mockImplementation(() => time);
    const changed = vi.fn(); const gate = new BrowserCredentialUnlock(changed, async () => true);
    await gate.unlock(parent, () => {}); const guard = gate.capture();
    time += CREDENTIAL_UNLOCK_MS; expect(guard).toThrow('bloqueada');
    vi.advanceTimersByTime(CREDENTIAL_UNLOCK_MS); expect(changed).toHaveBeenCalledTimes(3);
  });
  it.each(['bloqueo', 'perfil', 'tardía'] as const)('no concede una respuesta tardía: %s', async mode => {
    let resolve!: (value: boolean) => void; let time = 0; let valid = true;
    vi.spyOn(performance, 'now').mockImplementation(() => time);
    const verify = vi.fn<(parent: BrowserWindow, signal: AbortSignal) => Promise<boolean>>(() => new Promise<boolean>(done => { resolve = done; }));
    const gate = new BrowserCredentialUnlock(vi.fn(), verify);
    const result = gate.unlock(parent, () => { if (!valid) throw new Error('Perfil cambiado'); });
    await expect(gate.unlock(parent, () => {})).rejects.toThrow('pendiente');
    if (mode === 'bloqueo') { gate.lock(); expect(verify.mock.calls[0][1].aborted).toBe(true); }
    if (mode === 'perfil') valid = false;
    if (mode === 'tardía') time = 60_000;
    resolve(true);
    if (mode === 'perfil') await expect(result).rejects.toThrow('Perfil cambiado');
    else expect(await result).toBe(false);
    expect(gate.isUnlocked()).toBe(false);
  });
  it('rechaza payloads abiertos y nunca acepta approved ni un PIN', () => {
    for (const raw of [null, [], { action: 'unlock', profileRevision: -1 }, { action: 'unlock', profileRevision: 1, approved: true },
      { action: 'unlock', profileRevision: 1, pin: 'ficticio' }, { action: 'unlock' }, { action: { toString: () => 'unlock' }, profileRevision: 1 }]) {
      expect(() => validateCredentialSessionRequest(raw)).toThrow();
    }
    expect(validateCredentialSessionRequest({ action: 'lock', profileRevision: 1 })).toEqual({ action: 'lock', profileRevision: 1 });
  });
  it('el helper usa interop HWND, no recibe contraseñas ni interpolaciones libres', () => {
    expect(() => windowsHelloScript(-1n)).toThrow(); expect(() => windowsHelloScript(0n)).toThrow();
    const script = windowsHelloScript(123n);
    expect(script).toContain('39E050C3-4E74-441A-8DC0-B81104DF949C');
    expect(script).toContain('::Run(123, $false)');
    expect(windowsHelloScript(0n, true)).toContain('::Run(0, $true)');
    expect(script).not.toContain('LogonUser'); expect(script).not.toContain('Read-Host');
  });
});
