import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BrowserWindow, dialog, safeStorage, type WebContents } from 'electron';
import { BrowserCredentialAutosave, parseCredentialCandidate } from '../integrated-browser/credential-autosave';
import { CREDENTIAL_BINDING, CREDENTIAL_WORLD } from '../integrated-browser/credential-autosave-script';
import { acquireCdpLease, type CdpLease } from '../integrated-browser/cdp-session';
import { BrowserCredentialSaver } from '../integrated-browser/credential-saver';
import { BrowserCredentialVault } from '../integrated-browser/credential-vault';

vi.mock('../integrated-browser/cdp-session', () => ({ acquireCdpLease: vi.fn() }));
const roots: string[] = [];
beforeEach(() => { vi.clearAllMocks(); vi.mocked(safeStorage.isEncryptionAvailable).mockReturnValue(true); });
afterEach(async () => {
  vi.useRealTimers();
  for (const root of roots.splice(0)) await fs.rm(root, { recursive: true, force: true });
});
const candidate = { origin: 'https://example.com', username: 'cuenta', password: 'ficticia-segura-93!' };

async function bridge() {
  const handlers = new Map<string, (params: Record<string, unknown>) => void>();
  const lease = { alive: true, on: vi.fn((name, handler) => handlers.set(name, handler)),
    send: vi.fn(async (method) => method === 'Page.getFrameTree' ? { frameTree: { frame: { id: 'main' } } } : { identifier: 'script-1' }),
    release: vi.fn(async () => {}) };
  vi.mocked(acquireCdpLease).mockResolvedValue(lease as unknown as CdpLease);
  const offer = vi.fn();
  const contents = { isDestroyed: () => false, getURL: () => 'https://example.com/login' } as unknown as WebContents;
  const observer = new BrowserCredentialAutosave(contents, offer);
  const emit = (name: string, params: Record<string, unknown>) => handlers.get(name)?.(params);
  const context = (id: number, frameId = 'main', name?: string) => emit('Runtime.executionContextCreated', { context: { id, name: name ?? (observer as unknown as { world: string }).world, uniqueId: 'unique-' + id, auxData: { frameId } } });
  const submit = (id = 1, payload = JSON.stringify(candidate)) => emit('Runtime.bindingCalled', { name: CREDENTIAL_BINDING, executionContextId: id, payload });
  await observer.install();
  return { observer, lease, offer, emit, context, submit };
}

describe('sugerencias de credenciales: puente y límites', () => {
  it.each([
    null, '{}', '{', 'x'.repeat(30_001), JSON.stringify({ ...candidate, origin: 'http://example.com' }),
    JSON.stringify({ ...candidate, origin: 'https://example.com/path' }), JSON.stringify({ ...candidate, approved: true }),
    JSON.stringify({ ...candidate, username: 'x\u202ey' }), JSON.stringify({ ...candidate, password: 'x'.repeat(4_097) }),
  ])('rechaza payload no permitido %j', (payload) => { expect(parseCredentialCandidate(payload)).toBeNull(); });

  it('acepta sólo el mundo privado del marco principal y borra la copia del candidato', async () => {
    const f = await bridge();
    let captured: unknown;
    f.offer.mockImplementation((input) => { captured = { ...input }; });
    f.submit();
    f.context(2, 'main', 'soflia-agent'); f.submit(2);
    f.context(3, 'iframe'); f.submit(3);
    expect(f.offer).not.toHaveBeenCalled();
    f.context(1); f.submit();
    expect(captured).toEqual(candidate);
    expect(f.offer.mock.calls[0][0].password).toBe('');
    expect(f.lease.send).toHaveBeenCalledWith('Runtime.addBinding', { name: CREDENTIAL_BINDING, executionContextName: expect.stringMatching(new RegExp('^' + CREDENTIAL_WORLD + '-')) });
    await f.observer.dispose();
    expect(f.lease.send).toHaveBeenCalledWith('Runtime.evaluate', expect.objectContaining({ uniqueContextId: 'unique-1', silent: true }));
    f.submit();
    expect(f.offer).toHaveBeenCalledTimes(1);
    expect(f.lease.release).toHaveBeenCalledOnce();
  });

  it('rechaza contexto destruido, origen distinto y desconexión', async () => {
    const f = await bridge();
    f.context(1); f.submit(1, JSON.stringify({ ...candidate, origin: 'https://otro.example' }));
    f.emit('Runtime.executionContextDestroyed', { executionContextId: 1 }); f.submit();
    f.context(1); f.emit('Runtime.executionContextsCleared', {}); f.submit();
    f.context(1); f.lease.alive = false; f.submit();
    expect(f.offer).not.toHaveBeenCalled();
    await f.observer.dispose();
  });

  it('desmonta también si se cierra durante la instalación', async () => {
    let resolve!: (lease: CdpLease) => void;
    const lease = { alive: true, send: vi.fn(), release: vi.fn(async () => {}), on: vi.fn() };
    vi.mocked(acquireCdpLease).mockReturnValue(new Promise((done) => { resolve = done; }));
    const observer = new BrowserCredentialAutosave({ isDestroyed: () => false } as WebContents, vi.fn());
    const installing = observer.install();
    const disposing = observer.dispose();
    resolve(lease as unknown as CdpLease);
    lease.send.mockResolvedValue({});
    expect(await installing).toBe(false);
    await disposing;
    expect(lease.send).not.toHaveBeenCalledWith('Runtime.addBinding', expect.anything());
    expect(lease.release).toHaveBeenCalledOnce();
  });
});

describe('sugerencia, cifrado y confirmación nativa', () => {
  async function fixture() {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'soflia-autosave-'));
    roots.push(root);
    const file = path.join(root, 'vault.json');
    const vault = new BrowserCredentialVault(file);
    const saver = new BrowserCredentialSaver(vault);
    const context = { origin: candidate.origin, parent: new BrowserWindow(), assertCurrent: vi.fn() };
    return { file, vault, saver, context };
  }

  it('requiere confirmación para una cuenta nueva y no muestra el secreto', async () => {
    const f = await fixture();
    vi.mocked(dialog.showMessageBox).mockResolvedValueOnce({ response: 0, checkboxChecked: false });
    expect(await f.saver.save(candidate, f.context, true)).toEqual({ canceled: true });
    expect(await f.vault.list()).toEqual([]);
    const calls = vi.mocked(dialog.showMessageBox).mock.calls as unknown as Array<[BrowserWindow, unknown]>;
    expect(JSON.stringify(calls.map((call) => call[1]))).not.toContain(candidate.password);
    vi.mocked(dialog.showMessageBox).mockResolvedValueOnce({ response: 1, checkboxChecked: false });
    expect(await f.saver.save(candidate, f.context, true)).toMatchObject({ canceled: false, credential: { username: candidate.username } });
    expect(await fs.readFile(f.file, 'utf8')).not.toContain(candidate.username);
    expect(await f.saver.save(candidate, f.context, true)).toEqual({ canceled: true });
    expect(dialog.showMessageBox).toHaveBeenCalledTimes(2);
  });

  it('no sustituye la cuenta si el contexto cambia durante el diálogo', async () => {
    const f = await fixture();
    const stored = await f.vault.save(candidate.origin, candidate);
    vi.mocked(dialog.showMessageBox).mockImplementationOnce(async () => {
      f.context.assertCurrent.mockImplementation(() => { throw new Error('Perfil cambiado.'); });
      return { response: 1, checkboxChecked: false };
    });
    await expect(f.saver.save({ ...candidate, password: 'nueva-ficticia' }, f.context, true)).rejects.toThrow('Perfil cambiado');
    expect((await f.vault.resolveSecret(stored.id, candidate.origin)).password).toBe(candidate.password);
  });

  it('persiste el opt-in cifrado, evita revisiones obsoletas y lo conserva al borrar', async () => {
    const f = await fixture();
    expect(await f.vault.getAutosaveEnabled()).toBe(false);
    const review = await f.vault.prepareSave(candidate.origin, candidate);
    await f.vault.setAutosaveEnabled(true, () => {});
    expect(await new BrowserCredentialVault(f.file).getAutosaveEnabled()).toBe(true);
    expect(await fs.readFile(f.file, 'utf8')).not.toContain('autosaveEnabled');
    await expect(review.commit()).rejects.toThrow('bóveda cambió');
    const stored = await f.vault.save(candidate.origin, candidate);
    await f.vault.remove(stored.id, candidate.origin);
    await f.vault.clearAll();
    expect(await f.vault.getAutosaveEnabled()).toBe(true);
  });
});
