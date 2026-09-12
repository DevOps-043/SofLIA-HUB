import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BrowserWindow, dialog, safeStorage } from 'electron';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { BrowserCredentialVault, BrowserHistoryStore } from '../integrated-browser';
import { BrowserCredentialSaver } from '../integrated-browser/credential-saver';

let testRoot = '';

beforeEach(async () => {
  testRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'soflia-browser-storage-'));
  vi.mocked(safeStorage.isEncryptionAvailable).mockReturnValue(true);
});

afterEach(async () => {
  await fs.rm(testRoot, { recursive: true, force: true });
});

describe('persistencia privada del navegador integrado', () => {
  it('recupera contraseñas Unicode en el límite y rechaza usuarios con controles', async () => {
    const vault = new BrowserCredentialVault(path.join(testRoot, 'unicode.json'));
    const password = '漢'.repeat(4096);
    const credential = await vault.save('https://example.com', { username: 'cuenta', password });
    expect((await vault.resolveSecret(credential.id, 'https://example.com')).password).toBe(password);
    await expect(vault.save('https://example.com', { username: 'cuenta\nSitio falso', password: 'ficticia' })).rejects.toThrow('usuario');
    await expect(vault.save('https://usuario:ficticia@example.com', { username: 'cuenta', password: 'ficticia' })).rejects.toThrow('HTTPS');
    expect(await vault.list()).toHaveLength(1);
  });

  it('prepara sin escribir y actualiza conservando identidad sólo al confirmar', async () => {
    const file = path.join(testRoot, 'revision.json');
    const vault = new BrowserCredentialVault(file);
    const saved = await vault.save('https://example.com', { username: 'cuenta', password: 'anterior-ficticia' });
    const original = await fs.readFile(file, 'utf8');
    const input = { id: saved.id, username: 'cuenta-nueva', password: 'nueva-ficticia' };
    const prepared = await vault.prepareSave('https://example.com', input);
    input.password = 'alterada'; input.username = 'alterada';
    expect(prepared).toMatchObject({ updating: true, username: 'cuenta-nueva', origin: 'https://example.com' });
    expect(JSON.stringify(prepared)).not.toContain('ficticia');
    expect(await fs.readFile(file, 'utf8')).toBe(original);
    expect(await prepared.commit()).toMatchObject({ id: saved.id, createdAt: saved.createdAt, username: 'cuenta-nueva' });
    expect((await vault.resolveSecret(saved.id, 'https://example.com')).password).toBe('nueva-ficticia');
    await expect(prepared.commit()).rejects.toThrow('ya se utilizó');
  });

  it('rechaza IDs ajenos, desaparecidos y renombrados que colisionan', async () => {
    const vault = new BrowserCredentialVault(path.join(testRoot, 'identidad.json'));
    const first = await vault.save('https://example.com', { username: 'uno', password: 'uno-ficticia' });
    await vault.save('https://example.com', { username: 'dos', password: 'dos-ficticia' });
    await expect(vault.prepareSave('https://other.example', { id: first.id, username: 'uno', password: 'nueva' })).rejects.toThrow('no pertenece');
    await expect(vault.prepareSave('https://example.com', { id: first.id, username: 'dos', password: 'nueva' })).rejects.toThrow('otra credencial');
    await vault.remove(first.id, 'https://example.com');
    await expect(vault.prepareSave('https://example.com', { id: first.id, username: 'uno', password: 'nueva' })).rejects.toThrow('ya no existe');
    expect(await vault.list()).toHaveLength(1);
  });

  it('una revisión no sobrescribe cambios de otra instancia de la bóveda', async () => {
    const file = path.join(testRoot, 'concurrencia.json');
    const a = new BrowserCredentialVault(file); const b = new BrowserCredentialVault(file);
    const saved = await a.save('https://example.com', { username: 'cuenta', password: 'anterior' });
    const review = await a.prepareSave('https://example.com', { username: 'cuenta', password: 'obsoleta' });
    await b.save('https://example.com', { username: 'cuenta', password: 'vigente' });
    await expect(review.commit()).rejects.toThrow('cambió');
    expect((await a.resolveSecret(saved.id, 'https://example.com')).password).toBe('vigente');
  });

  it('serializa commits concurrentes y conserva sólo el que pudo verificar su revisión', async () => {
    const file = path.join(testRoot, 'commits.json');
    const a = new BrowserCredentialVault(file); const b = new BrowserCredentialVault(file);
    const [first, second] = await Promise.all([
      a.prepareSave('https://example.com', { username: 'uno', password: 'ficticia' }),
      b.prepareSave('https://example.com', { username: 'dos', password: 'ficticia' }),
    ]);
    const results = await Promise.allSettled([first.commit(), second.commit()]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    expect(await a.list()).toHaveLength(1);
  });

  it('rechaza una revisión vencida o un contexto invalidado sin crear archivo', async () => {
    const file = path.join(testRoot, 'expiracion.json');
    const vault = new BrowserCredentialVault(file);
    const expired = await vault.prepareSave('https://example.com', { username: 'cuenta', password: 'ficticia' });
    const clock = vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 300_001);
    try { await expect(expired.commit()).rejects.toThrow('venció'); }
    finally { clock.mockRestore(); }
    const stale = await vault.prepareSave('https://example.com', { username: 'cuenta', password: 'ficticia' });
    await expect(stale.commit(() => { throw new Error('Contexto cambiado'); })).rejects.toThrow('Contexto cambiado');
    await expect(fs.stat(file)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('conserva la bóveda anterior y limpia su temporal si falla el reemplazo', async () => {
    const file = path.join(testRoot, 'fallo.json'); const vault = new BrowserCredentialVault(file);
    await vault.save('https://example.com', { username: 'cuenta', password: 'anterior' });
    const previous = await fs.readFile(file, 'utf8');
    const review = await vault.prepareSave('https://example.com', { username: 'cuenta', password: 'nueva' });
    const rename = vi.spyOn(fs, 'rename').mockRejectedValueOnce(new Error('EACCES'));
    try { await expect(review.commit()).rejects.toThrow('EACCES'); } finally { rename.mockRestore(); }
    expect(await fs.readFile(file, 'utf8')).toBe(previous);
    expect(await fs.readdir(testRoot)).toEqual(['fallo.json']);
  });

  it.each([0, 1])('el diálogo nativo decide el reemplazo, respuesta %s', async (response) => {
    const vault = new BrowserCredentialVault(path.join(testRoot, 'dialogo.json'));
    const saved = await vault.save('https://example.com', { username: 'cuenta', password: 'anterior-ficticia' });
    vi.mocked(dialog.showMessageBox).mockResolvedValueOnce({ response, checkboxChecked: false });
    const saver = new BrowserCredentialSaver(vault);
    const result = await saver.save({ username: 'cuenta', password: 'nueva-ficticia' }, { origin: 'https://example.com', parent: new BrowserWindow(), assertCurrent: () => {} });
    expect(result.canceled).toBe(response !== 1);
    const calls = vi.mocked(dialog.showMessageBox).mock.calls as unknown[][];
    const options = calls[calls.length - 1]?.[1];
    expect(options).toMatchObject({ defaultId: 0, cancelId: 0, detail: expect.stringContaining('https://example.com') });
    expect(JSON.stringify(options)).not.toContain('ficticia');
    expect((await vault.resolveSecret(saved.id, 'https://example.com')).password).toBe(response === 1 ? 'nueva-ficticia' : 'anterior-ficticia');
  });

  it('una aprobación tardía no escribe si el contexto cambió y libera el siguiente intento', async () => {
    const vault = new BrowserCredentialVault(path.join(testRoot, 'tardia.json'));
    await vault.save('https://example.com', { username: 'cuenta', password: 'anterior' });
    const saver = new BrowserCredentialSaver(vault);
    let changed = false;
    vi.mocked(dialog.showMessageBox).mockImplementationOnce(async () => { changed = true; return { response: 1, checkboxChecked: false }; });
    const context = { origin: 'https://example.com', parent: new BrowserWindow(), assertCurrent: () => { if (changed) throw new Error('Contexto cambiado'); } };
    await expect(saver.save({ username: 'cuenta', password: 'nueva' }, context)).rejects.toThrow('Contexto cambiado');
    changed = false;
    vi.mocked(dialog.showMessageBox).mockResolvedValueOnce({ response: 0, checkboxChecked: false });
    expect(await saver.save({ username: 'cuenta', password: 'nueva' }, context)).toEqual({ canceled: true });
  });

  it('rechaza guardados superpuestos antes de mostrar otro diálogo', async () => {
    const vault = new BrowserCredentialVault(path.join(testRoot, 'pendiente.json'));
    await vault.save('https://example.com', { username: 'cuenta', password: 'anterior' });
    let finish!: () => void;
    vi.mocked(dialog.showMessageBox).mockImplementationOnce(() => new Promise((resolve) => { finish = () => resolve({ response: 0, checkboxChecked: false }); }));
    const saver = new BrowserCredentialSaver(vault);
    const context = { origin: 'https://example.com', parent: new BrowserWindow(), assertCurrent: () => {} };
    const first = saver.save({ username: 'cuenta', password: 'nueva' }, context);
    await vi.waitFor(() => expect(finish).toBeTypeOf('function'));
    await expect(saver.save({ username: 'otra', password: 'nueva' }, context)).rejects.toThrow('pendiente');
    finish(); await first;
  });

  it('no registra fragmentos del archivo malformado ni lee archivos sin cota', async () => {
    const file = path.join(testRoot, 'invalida.json'); const vault = new BrowserCredentialVault(file);
    await fs.writeFile(file, '{"secreto":"ficticio-sensible"');
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      await expect(vault.list()).rejects.toThrow('danada');
      expect(JSON.stringify(log.mock.calls)).not.toContain('ficticio-sensible');
      const handle = await fs.open(file, 'w'); await handle.truncate(12 * 1024 * 1024 + 1); await handle.close();
      await expect(vault.list()).rejects.toThrow('danada');
    } finally { log.mockRestore(); }
  });
  it('mantiene cada escritura y borrado de credenciales en el perfil que los inició', async () => {
    let location = path.join(testRoot, 'vault-a.json');
    const vault = new BrowserCredentialVault(() => location);
    const first = vault.save('https://example.com', { username: 'cuenta-a', password: 'Secreto-ficticio-A1!' });
    location = path.join(testRoot, 'vault-b.json');
    const second = vault.save('https://example.com', { username: 'cuenta-b', password: 'Secreto-ficticio-B2!' });
    await Promise.all([first, second]);
    expect((await vault.list()).map((credential) => credential.username)).toEqual(['cuenta-b']);
    location = path.join(testRoot, 'vault-a.json');
    const clearing = vault.clearAll();
    location = path.join(testRoot, 'vault-b.json');
    await clearing;
    expect((await vault.list()).map((credential) => credential.username)).toEqual(['cuenta-b']);
    location = path.join(testRoot, 'vault-a.json');
    expect(await vault.list()).toEqual([]);
  });

  it('limpia visitas que vencen después de configurar la retención', async () => {
    const store = new BrowserHistoryStore(path.join(testRoot, 'retention-aging.sqlite'), null);
    const started = Date.now();
    await store.record({ url: 'https://aging.example', visitedAt: new Date(started).toISOString() });
    await store.setRetention(30);
    const clock = vi.spyOn(Date, 'now').mockReturnValue(started + 31 * 86_400_000);
    try { expect(await store.list()).toEqual([]); }
    finally { clock.mockRestore(); await store.flushAndClose(); }
  });

  it('persiste retención, elimina visitas vencidas y rechaza valores no admitidos', async () => {
    const location = path.join(testRoot, 'retention.sqlite');
    const store = new BrowserHistoryStore(location, null);
    const past = new Date(Date.now() - 45 * 86_400_000).toISOString();
    await store.record({ url: 'https://old.example', visitedAt: past });
    await store.record({ url: 'https://recent.example' });
    expect(await store.setRetention(30)).toEqual({ days: 30, removed: 1 });
    expect(await store.record({ url: 'https://retroactive.example', visitedAt: past })).toBeNull();
    expect((await store.list()).map((entry) => entry.url)).toEqual(['https://recent.example/']);
    await expect(store.setRetention(-1)).rejects.toThrow('retención');
    await store.flushAndClose();
    const reopened = new BrowserHistoryStore(location, null);
    expect(await reopened.getRetention()).toBe(30);
    await reopened.flushAndClose();
  });

  it('aísla retención entre perfiles y aplica el límite administrado más estricto', async () => {
    let location = path.join(testRoot, 'retention-a.sqlite');
    const store = new BrowserHistoryStore(() => location, null);
    const pending = store.setRetention(90);
    location = path.join(testRoot, 'retention-b.sqlite');
    await pending;
    expect(await store.getRetention()).toBeNull();
    location = path.join(testRoot, 'retention-a.sqlite');
    expect(await store.getRetention()).toBe(90);
    await store.setManagedRetention(30);
    expect(await store.getRetention()).toBe(30);
    await store.setManagedRetention(null);
    expect(await store.getRetention()).toBe(90);
    await store.flushAndClose();
  });

  it('no cruza escrituras pendientes al cambiar el destino del perfil', async () => {
    let destination = path.join(testRoot, 'a.sqlite');
    const store = new BrowserHistoryStore(() => destination, null);
    const a = store.record({ url: 'https://a.example' });
    destination = path.join(testRoot, 'b.sqlite');
    const b = store.record({ url: 'https://b.example' });
    await Promise.all([a, b]);
    expect((await store.list()).map((entry) => entry.url)).toEqual(['https://b.example/']);
    destination = path.join(testRoot, 'a.sqlite');
    expect((await store.list()).map((entry) => entry.url)).toEqual(['https://a.example/']);
    await store.flushAndClose();
  });

  it('conserva visitas retroactivas y busca títulos actualizados sin índices obsoletos', async () => {
    const store = new BrowserHistoryStore(path.join(testRoot, 'past.sqlite'), null);
    await store.record({ url: 'https://www.example.com', title: 'Anterior', visitedAt: '2026-08-02' });
    await store.record({ url: 'https://www.example.com', title: 'Actual', visitedAt: '2026-08-01' });
    expect(await store.list({ domain: 'example.com' })).toHaveLength(2);
    expect(await store.list({ query: 'Actual' })).toHaveLength(2);
    expect(await store.list({ query: 'Anterior' })).toHaveLength(0);
    await store.flushAndClose();
  });

  it('guarda historial, elimina credenciales de URL y conserva lineas validas', async () => {
    const file = path.join(testRoot, 'history.sqlite');
    const legacy = path.join(testRoot, 'history.jsonl');
    await fs.writeFile(legacy, `${JSON.stringify({ id: 'legacy', url: 'https://legacy.example/', title: 'Anterior', visitedAt: '2026-01-01T00:00:00.000Z' })}\n{linea rota}\n`, 'utf8');
    const store = new BrowserHistoryStore(file, legacy);
    await store.record({ url: 'https://user:secret@example.com/ruta', title: ' Ejemplo\nprivado ' });

    const entries = await store.list({ query: 'ejemplo', limit: 10 });
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ url: 'https://example.com/ruta', title: 'Ejemplo privado' });
    expect((await store.list({ query: 'anterior' }))[0]?.url).toBe('https://legacy.example/');
    expect(await fs.stat(`${legacy}.migrated`)).toBeDefined();

    await store.clear();
    expect(await store.list()).toEqual([]);
    await expect(fs.stat(legacy)).rejects.toMatchObject({ code: 'ENOENT' });
    await expect(fs.stat(`${legacy}.migrated`)).rejects.toMatchObject({ code: 'ENOENT' });
    store.close();
  });

  it('busca dominio y ruta sin hacer coincidir todas las URLs por https', async () => {
    const store = new BrowserHistoryStore(path.join(testRoot, 'history-search.sqlite'), null);
    await store.record({ url: 'https://www.google.com/', title: 'Google' });
    await store.record({ url: 'https://soflia.ai/aprender', title: 'SofLIA Learn' });

    expect((await store.list({ query: 's', limit: 10 })).map((entry) => entry.title)).toEqual(['SofLIA Learn']);
    expect((await store.list({ query: 'www.google', limit: 10 })).map((entry) => entry.title)).toEqual(['Google']);
    expect(await store.list({ query: 'https://', limit: 10 })).toHaveLength(2);
    store.close();
  });

  it('pagina y filtra el historial por dominio y fecha', async () => {
    const store = new BrowserHistoryStore(path.join(testRoot, 'history-filters.sqlite'), null);
    await store.record({ url: 'https://docs.example.com/uno', title: 'Uno', visitedAt: '2026-08-01T00:00:00.000Z' });
    await store.record({ url: 'https://docs.example.com/dos', title: 'Dos', visitedAt: '2026-08-02T00:00:00.000Z' });
    await store.record({ url: 'https://otro.example/tres', title: 'Tres', visitedAt: '2026-08-03T00:00:00.000Z' });
    expect((await store.list({ domain: 'docs.example.com', from: '2026-08-02T00:00:00.000Z' })).map((entry) => entry.title)).toEqual(['Dos']);
    expect((await store.list({ limit: 1, offset: 1 }))[0]?.title).toBe('Dos');
    store.close();
  });

  it('cifra contrasenas, expone solo metadatos y exige el origen exacto', async () => {
    const file = path.join(testRoot, 'credentials.json');
    const vault = new BrowserCredentialVault(file);
    const saved = await vault.save('https://example.com/login', { username: 'usuario@example.com', password: 'secreto-irrepetible' });

    expect(saved).not.toHaveProperty('password');
    expect(await vault.list('https://example.com')).toEqual([saved]);
    expect(await fs.readFile(file, 'utf8')).not.toContain('secreto-irrepetible');
    await expect(vault.resolveSecret(saved.id, 'https://otro.example')).rejects.toThrow(/sitio actual/i);
    expect((await vault.resolveSecret(saved.id, 'https://example.com/cuenta')).password).toBe('secreto-irrepetible');
    expect(await vault.remove(saved.id, 'https://otro.example')).toBe(false);
    expect(await vault.remove(saved.id, 'https://example.com')).toBe(true);
  });

  it('falla cerrado si el cifrado no esta disponible o la boveda esta danada', async () => {
    const file = path.join(testRoot, 'credentials.json');
    const vault = new BrowserCredentialVault(file);
    vi.mocked(safeStorage.isEncryptionAvailable).mockReturnValue(false);
    await expect(vault.save('https://example.com', { username: 'usuario', password: 'secreto' })).rejects.toThrow(/almacenamiento seguro/i);

    vi.mocked(safeStorage.isEncryptionAvailable).mockReturnValue(true);
    await fs.writeFile(file, '{no-es-json', 'utf8');
    await expect(vault.list()).rejects.toThrow(/boveda.+danada/i);
  });
});
