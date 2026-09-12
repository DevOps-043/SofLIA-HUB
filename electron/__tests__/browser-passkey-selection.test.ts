import { EventEmitter } from 'node:events';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { dialog, type BrowserWindow, type SelectWebauthnAccountDetails, type Session, type WebContents } from 'electron';
import { BrowserPasskeySelection, PASSKEY_SELECTION_TIMEOUT_MS } from '../integrated-browser/passkey-selection';

afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });
function setup() {
  const session = new EventEmitter();
  const parent = Object.assign(new EventEmitter(), { isDestroyed: (): boolean => false, isVisible: (): boolean => true });
  const frame = { detached: false };
  const contents = Object.assign(new EventEmitter(), { mainFrame: frame, isDestroyed: (): boolean => false, getURL: (): string => 'https://login.example.com/acceso' });
  const guard = vi.fn();
  const resolve = vi.fn(() => ({ parent: parent as BrowserWindow, contents: contents as unknown as WebContents, assertCurrent: guard }));
  const picker = new BrowserPasskeySelection(session as Session, resolve);
  const details = { frame, relyingPartyId: 'example.com', accounts: [{ credentialId: 'cuenta_1', name: 'Primera' }, { credentialId: 'cuenta_2', name: 'Segunda' }] } as SelectWebauthnAccountDetails;
  const choose = (input = details) => { const callback = vi.fn(); session.emit('select-webauthn-account', {}, input, callback); return callback; };
  return { session, parent, contents, frame, guard, resolve, picker, details, choose };
}

describe('selección humana de passkeys', () => {
  it('elige exactamente la cuenta revisada, sin persistencia ni elección automática', async () => {
    const fixture = setup();
    vi.mocked(dialog.showMessageBox).mockResolvedValue({ response: 2, checkboxChecked: false });
    const done = fixture.choose(); await vi.waitFor(() => expect(done).toHaveBeenCalledWith('cuenta_2'));
    expect(done).toHaveBeenCalledTimes(1);
    const calls = vi.mocked(dialog.showMessageBox).mock.calls as unknown as Array<[BrowserWindow, Electron.MessageBoxOptions]>;
    const options = calls[calls.length - 1][1];
    expect(options.defaultId).toBe(0); expect(options.buttons).toEqual(['Cancelar', '1. Primera', '2. Segunda']);
    expect(JSON.stringify(options)).not.toContain('cuenta_');
    fixture.picker.dispose(); expect(fixture.session.listenerCount('select-webauthn-account')).toBe(0);
  });

  it.each(['cancelar', 'error', 'perfil', 'navegar', 'ocultar', 'cerrar', 'plazo', 'control'] as const)('cancela una sola vez ante %s', async reason => {
    vi.useFakeTimers(); const fixture = setup();
    let resolve!: (value: Electron.MessageBoxReturnValue) => void;
    let reject!: (reason: Error) => void;
    vi.mocked(dialog.showMessageBox).mockImplementation(() => new Promise((yes, no) => { resolve = yes; reject = no; }));
    const done = fixture.choose();
    if (reason === 'perfil') fixture.guard.mockImplementation(() => { throw new Error('Cambio de perfil'); });
    if (reason === 'navegar') fixture.contents.emit('did-start-navigation', {}, 'https://otra.example', false, true);
    if (reason === 'ocultar') fixture.parent.emit('hide');
    if (reason === 'cerrar') fixture.picker.dispose();
    if (reason === 'plazo') vi.advanceTimersByTime(PASSKEY_SELECTION_TIMEOUT_MS);
    if (reason === 'control') fixture.picker.cancel();
    if (reason === 'error') reject(new Error('Información nativa que no debe publicarse'));
    else resolve({ response: reason === 'cancelar' ? 0 : 1, checkboxChecked: false });
    await Promise.resolve(); await Promise.resolve();
    expect(done).toHaveBeenCalledExactlyOnceWith(undefined);
    expect(fixture.contents.listenerCount('did-start-navigation')).toBe(0);
    expect(fixture.parent.listenerCount('hide')).toBe(0);
    fixture.picker.dispose();
  });

  it('no acumula diálogos mientras el anterior todavía se cierra', async () => {
    const fixture = setup(); let resolve!: (value: Electron.MessageBoxReturnValue) => void;
    vi.mocked(dialog.showMessageBox).mockImplementation(() => new Promise(done => { resolve = done; }));
    const first = fixture.choose(); fixture.picker.cancel();
    const second = fixture.choose(); expect(second).toHaveBeenCalledExactlyOnceWith();
    resolve({ response: 1, checkboxChecked: false }); await Promise.resolve();
    expect(first).toHaveBeenCalledExactlyOnceWith(undefined); fixture.picker.dispose();
  });

  it.each(['marco', 'http', 'rp', 'vacía', 'exceso', 'duplicada', 'id', 'oculta'] as const)('rechaza antes de mostrar la selección: %s', async kind => {
    const fixture = setup(); vi.mocked(dialog.showMessageBox).mockClear();
    if (kind === 'marco') fixture.details.frame = null;
    if (kind === 'http') fixture.contents.getURL = () => 'http://login.example.com';
    if (kind === 'rp') fixture.details.relyingPartyId = 'otro.example.com';
    if (kind === 'vacía') fixture.details.accounts = [];
    if (kind === 'exceso') fixture.details.accounts = Array.from({ length: 11 }, (_, i) => ({ credentialId: `id${i}` }));
    if (kind === 'duplicada') fixture.details.accounts[1].credentialId = 'cuenta_1';
    if (kind === 'id') fixture.details.accounts[0].credentialId = '<script>';
    if (kind === 'oculta') fixture.parent.isVisible = () => false;
    const done = fixture.choose(); await Promise.resolve();
    expect(done).toHaveBeenCalledExactlyOnceWith(undefined); expect(dialog.showMessageBox).not.toHaveBeenCalled();
    fixture.picker.dispose();
  });
});
