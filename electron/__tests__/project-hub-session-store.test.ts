import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { ProjectHubSessionStore } from '../project-hub/session-store';
import { MAX_PROJECT_HUB_CIPHER_BYTES } from '../project-hub/session-contract';
import { credentials, deferred, testCipher, workspace } from './project-hub/fixtures';

let root: string;
const guard = () => {};
const magic = Buffer.from('SOFLIA-PROJECT-HUB-1\n');
const file = (owner = 'A') => path.join(root, 'project-hub-sessions', createHash('sha256').update(owner).digest('hex') + '.bin');
beforeEach(async () => { root = await fs.mkdtemp(path.join(os.tmpdir(), 'soflia-project-session-test-')); });
afterEach(async () => {
  const resolved = await fs.realpath(root);
  expect(path.dirname(resolved)).toBe(await fs.realpath(os.tmpdir()));
  expect(path.basename(resolved)).toMatch(/^soflia-project-session-test-/);
  await fs.rm(resolved, { recursive: true, force: true });
});

describe('Custodia Project Hub con disco y AEAD reales', () => {
  it('cifra metadata/refresh y no persiste acceso ni expiración', async () => {
    const cipher = testCipher(); const store = new ProjectHubSessionStore({ root: () => root, cipher });
    const session = { ...credentials(), accessToken: 'acceso-que-no-se-persiste', expiresAt: 12345 };
    await store.save('A', session, guard);
    expect(await store.load('A', guard)).toEqual(credentials());
    const bytes = await fs.readFile(file());
    expect(bytes.toString()).not.toMatch(/renovacion-ficticia|Espacio ficticio|acceso-que/);
    const payload = JSON.parse((await cipher.decrypt(bytes.subarray(magic.length))).result);
    expect(payload).toEqual({ ...credentials(), version: 1, userId: 'A' });
    expect(await fs.readdir(path.dirname(file()))).toEqual([path.basename(file())]);
  });
  it('no comparte sesiones entre propietarios ni acepta trasladar el archivo', async () => {
    const store = new ProjectHubSessionStore({ root: () => root, cipher: testCipher() });
    await store.save('A', credentials(), guard);
    expect(await store.load('B', guard)).toBeNull();
    await fs.copyFile(file('A'), file('B'));
    await expect(store.load('B', guard)).rejects.toThrow('Propietario');
  });
  it('conserva el legado global sin leerlo ni adjudicarlo', async () => {
    const legacy = path.join(root, 'project-hub-session.enc'); const bytes = Buffer.from('legado-ficticio-sin-dueno');
    await fs.writeFile(legacy, bytes);
    const store = new ProjectHubSessionStore({ root: () => root, cipher: testCipher() });
    expect(await store.load('A', guard)).toBeNull();
    await store.clear('A');
    expect(await fs.readFile(legacy)).toEqual(bytes);
  });
  it('rechaza custodia no disponible sin crear fallback plano', async () => {
    const cipher = testCipher(); vi.mocked(cipher.available).mockResolvedValue(false);
    const store = new ProjectHubSessionStore({ root: () => root, cipher });
    await expect(store.save('A', credentials(), guard)).rejects.toThrow('Custodia');
    expect(await fs.readdir(root)).toEqual([]);
  });
  it('conserva bytes al fallar descifrado y continúa la cola después del error', async () => {
    const cipher = testCipher(); const store = new ProjectHubSessionStore({ root: () => root, cipher });
    await store.save('A', credentials(), guard);
    const bytes = await fs.readFile(file()); bytes[bytes.length - 1] ^= 1; await fs.writeFile(file(), bytes);
    await expect(store.load('A', guard)).rejects.toThrow();
    expect(await fs.readFile(file())).toEqual(bytes);
    await store.save('A', credentials('nueva'), guard);
    expect(await store.load('A', guard)).toEqual(credentials('nueva'));
  });
  it.each([
    { version: 2, userId: 'A', ...credentials() },
    { version: 1, userId: 'A', refreshToken: '', workspaces: [workspace()] },
    { version: 1, userId: 'A', refreshToken: 'ficticio', workspaces: 'incorrecto' },
    { version: 1, userId: 'A', ...credentials(), accessToken: 'no-permitido' },
  ])('rechaza payload versionado inválido sin publicar metadata: %#', async payload => {
    const cipher = testCipher(); const store = new ProjectHubSessionStore({ root: () => root, cipher });
    await fs.mkdir(path.dirname(file()), { recursive: true });
    await fs.writeFile(file(), Buffer.concat([magic, await cipher.encrypt(JSON.stringify(payload))]));
    await expect(store.load('A', guard)).rejects.toThrow();
  });
  it('rechaza formato/volumen inválido antes de descifrar', async () => {
    const cipher = testCipher(); const store = new ProjectHubSessionStore({ root: () => root, cipher });
    await fs.mkdir(path.dirname(file()), { recursive: true });
    await fs.writeFile(file(), Buffer.alloc(MAX_PROJECT_HUB_CIPHER_BYTES + 1));
    await expect(store.load('A', guard)).rejects.toThrow('privados');
    await fs.writeFile(file(), 'formato-no-reconocido');
    await expect(store.load('A', guard)).rejects.toThrow('Formato');
    expect(cipher.decrypt).not.toHaveBeenCalled();
  });
  it('no escribe cuando la identidad se invalida durante el cifrado', async () => {
    const cipher = testCipher(); const original = cipher.encrypt;
    const waiting = deferred<void>(); const entered = deferred<void>();
    cipher.encrypt = async text => { entered.resolve(); await waiting.promise; return original(text); };
    let valid = true;
    const store = new ProjectHubSessionStore({ root: () => root, cipher });
    const saving = store.save('A', credentials(), () => { if (!valid) throw new Error('contexto-retirado'); });
    const rejected = expect(saving).rejects.toThrow('contexto-retirado');
    await entered.promise; valid = false; waiting.resolve(); await rejected;
    expect(await fs.readdir(root)).toEqual([]);
  });
  it('serializa guardado, logout y nuevo login sin borrar el último', async () => {
    const cipher = testCipher(); const original = cipher.encrypt;
    const waiting = deferred<void>(); const entered = deferred<void>();
    vi.mocked(cipher.encrypt).mockImplementationOnce(async text => { entered.resolve(); await waiting.promise; return original(text); });
    const store = new ProjectHubSessionStore({ root: () => root, cipher });
    const first = store.save('A', credentials(), guard); await entered.promise;
    const clearing = store.clear('A'); const latest = store.save('A', credentials('ultima'), guard);
    waiting.resolve(); await Promise.all([first, clearing, latest]);
    expect(await store.load('A', guard)).toEqual(credentials('ultima'));
  });
  it('recifra cuando el proveedor lo solicita y no publica datos hasta terminar', async () => {
    const cipher = testCipher(); const store = new ProjectHubSessionStore({ root: () => root, cipher });
    await store.save('A', credentials(), guard);
    const decrypt = cipher.decrypt;
    vi.mocked(cipher.decrypt).mockImplementationOnce(async bytes => ({ ...await decrypt(bytes), shouldReEncrypt: true }));
    expect(await store.load('A', guard)).toEqual(credentials());
    expect(cipher.encrypt).toHaveBeenCalledTimes(2);
  });
  it('rechaza un directorio junction y no borra el archivo de su destino', async () => {
    const destination = path.join(root, 'destino-ficticio'); await fs.mkdir(destination);
    const target = path.join(destination, path.basename(file())); await fs.writeFile(target, 'no-borrar');
    await fs.symlink(destination, path.dirname(file()), 'junction');
    const store = new ProjectHubSessionStore({ root: () => root, cipher: testCipher() });
    await expect(store.load('A', guard)).rejects.toThrow('Directorio');
    await expect(store.clear('A')).rejects.toThrow('Directorio');
    await expect(store.save('A', credentials(), guard)).rejects.toThrow('Directorio');
    expect(await fs.readFile(target, 'utf8')).toBe('no-borrar');
    await fs.unlink(path.dirname(file()));
  });
});
