import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { safeStorage } from 'electron';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { BrowserCredentialVault } from '../integrated-browser/credential-vault';
import { openCredentialVault, sealCredentialVault } from '../integrated-browser/credential-vault-format';

let root: string;
const fake = { origin: 'https://privado.example', username: 'persona-ficticia@example.com', password: 'Sólo-prueba-漢-A12!' };
const id = 'aaaabbbb-1111-4444-9999-ccccddddeeee';
const scope = (file: string) => JSON.stringify([path.basename(path.dirname(file)), path.basename(file)]);
const legacy = () => ({ version: 1, credentials: [{ id, origin: fake.origin, username: fake.username,
  createdAt: '2026-09-01T12:00:00.000Z', updatedAt: '2026-09-01T12:00:00.000Z',
  passwordEncrypted: safeStorage.encryptString(fake.password).toString('base64') }] });
const decryptFile = async (file: string, target = file) => JSON.parse(openCredentialVault(JSON.parse(await fs.readFile(file, 'utf8')), scope(target)));

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'pulse-vault-format-'));
  vi.mocked(safeStorage.isEncryptionAvailable).mockReturnValue(true);
});
afterEach(async () => { vi.restoreAllMocks(); await fs.rm(root, { recursive: true, force: true }); });

describe('bóveda completa cifrada', () => {
  async function missingVault() {
    const file = path.join(root, 'credentials.json'); const vault = new BrowserCredentialVault(file);
    const metadata = await vault.save(fake.origin, fake);
    await vault.setAutosaveEnabled(true, () => undefined);
    await vault.save(fake.origin, { username: 'segunda', password: 'Otra-ficticia12!' });
    const backup = await fs.readFile(`${file}.bak`, 'utf8'); await fs.unlink(file);
    return { file, vault, metadata, backup };
  }

  it('no confunde principal ausente con bóveda vacía ni permite destruir el respaldo', async () => {
    const f = await missingVault();
    for (const operation of [() => f.vault.list(), () => f.vault.save(fake.origin, fake), () => f.vault.clearAll(), () => f.vault.setAutosaveEnabled(false, () => undefined)]) {
      await expect(operation()).rejects.toThrow('Falta el archivo principal');
    }
    expect(await fs.readFile(`${f.file}.bak`, 'utf8')).toBe(f.backup); await expect(fs.stat(f.file)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('recupera sólo tras commit, conserva respaldo y desactiva sugerencias sin exponer secretos', async () => {
    const f = await missingVault(); const prepared = await f.vault.prepareRecovery();
    expect(JSON.stringify(prepared)).toBe('{"count":1}'); await expect(fs.stat(f.file)).rejects.toMatchObject({ code: 'ENOENT' });
    expect(await prepared.commit(() => undefined)).toBe(1);
    expect(await f.vault.list()).toEqual([f.metadata]); expect(await f.vault.getAutosaveEnabled()).toBe(false);
    expect((await f.vault.resolveSecret(f.metadata.id, fake.origin)).password).toBe(fake.password);
    expect(await fs.readFile(`${f.file}.bak`, 'utf8')).toBe(f.backup);
    for (const forbidden of Object.values(fake)) expect(await fs.readFile(f.file, 'utf8')).not.toContain(forbidden);
    await expect(prepared.commit(() => undefined)).rejects.toThrow('ya se utilizó');
  });

  it.each(['principal', 'respaldo', 'perfil', 'control', 'vencimiento'] as const)('no aplica una recuperación obsoleta: %s', async (change) => {
    const f = await missingVault(); let location = f.file; const vault = new BrowserCredentialVault(() => location);
    const prepared = await vault.prepareRecovery();
    if (change === 'principal') await fs.writeFile(f.file, 'No reemplazar');
    if (change === 'respaldo') await fs.writeFile(`${f.file}.bak`, sealCredentialVault(JSON.stringify({ version: 1, credentials: [] }), scope(f.file)));
    if (change === 'perfil') location += '.otro';
    if (change === 'vencimiento') vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 5 * 60_000);
    await expect(prepared.commit(() => { if (change === 'control') throw new Error('Control revocado'); })).rejects.toThrow();
    if (change === 'principal') expect(await fs.readFile(f.file, 'utf8')).toBe('No reemplazar');
    else await expect(fs.stat(f.file)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('la publicación exclusiva no sobrescribe un principal que aparece durante la escritura', async () => {
    const f = await missingVault(); const prepared = await f.vault.prepareRecovery(); const link = fs.link.bind(fs);
    vi.spyOn(fs, 'link').mockImplementationOnce(async (source, destination) => {
      await fs.writeFile(destination, 'Principal concurrente'); return link(source, destination);
    });
    await expect(prepared.commit(() => undefined)).rejects.toMatchObject({ code: 'EEXIST' });
    expect(await fs.readFile(f.file, 'utf8')).toBe('Principal concurrente');
    expect(await fs.readFile(`${f.file}.bak`, 'utf8')).toBe(f.backup);
    expect((await fs.readdir(root)).some((entry) => entry.endsWith('.tmp'))).toBe(false);
  });

  it('un fallo de permisos no se interpreta como principal ausente', async () => {
    const f = await missingVault();
    vi.spyOn(fs, 'lstat').mockRejectedValueOnce(Object.assign(new Error('Detalle privado'), { code: 'EACCES' }));
    await expect(f.vault.prepareRecovery()).rejects.toThrow('No se pudo comprobar');
    await expect(fs.stat(f.file)).rejects.toMatchObject({ code: 'ENOENT' });
    expect(await fs.readFile(`${f.file}.bak`, 'utf8')).toBe(f.backup);
  });

  it('si el sistema de archivos rechaza enlaces conserva el respaldo y permite otra revisión', async () => {
    const f = await missingVault(); const prepared = await f.vault.prepareRecovery();
    vi.spyOn(fs, 'link').mockRejectedValueOnce(Object.assign(new Error('Sin enlaces'), { code: 'ENOTSUP' }));
    await expect(prepared.commit(() => undefined)).rejects.toMatchObject({ code: 'ENOTSUP' });
    await expect(fs.stat(f.file)).rejects.toMatchObject({ code: 'ENOENT' });
    expect(await fs.readFile(`${f.file}.bak`, 'utf8')).toBe(f.backup);
    expect((await fs.readdir(root)).some((entry) => entry.endsWith('.tmp'))).toBe(false);
    expect(await (await f.vault.prepareRecovery()).commit(() => undefined)).toBe(1);
  });

  it('un cambio de control después de escribir el temporal impide publicar la recuperación', async () => {
    const f = await missingVault(); const prepared = await f.vault.prepareRecovery();
    const guard = vi.fn(() => undefined).mockImplementationOnce(() => undefined)
      .mockImplementationOnce(() => undefined).mockImplementation(() => { throw new Error('Control revocado'); });
    const link = vi.spyOn(fs, 'link');
    await expect(prepared.commit(guard)).rejects.toThrow('Control revocado');
    expect(guard).toHaveBeenCalledTimes(3); expect(link).not.toHaveBeenCalled();
    await expect(fs.stat(f.file)).rejects.toMatchObject({ code: 'ENOENT' });
    expect(await fs.readFile(`${f.file}.bak`, 'utf8')).toBe(f.backup);
    expect((await fs.readdir(root)).some((entry) => entry.endsWith('.tmp'))).toBe(false);
  });

  it('conserva versiones futuras, corrupción y datos de otros perfiles sin recuperarlos', async () => {
    const f = await missingVault();
    for (const raw of [JSON.stringify({ version: 99 }), sealCredentialVault(JSON.stringify({ version: 99 }), scope(f.file))]) {
      await fs.writeFile(f.file, raw); await expect(f.vault.prepareRecovery()).rejects.toThrow('no es compatible');
      expect(await fs.readFile(f.file, 'utf8')).toBe(raw);
    }
    await fs.unlink(f.file);
    await fs.writeFile(`${f.file}.bak`, JSON.stringify(legacy())); await expect(f.vault.prepareRecovery()).rejects.toThrow('cifrado compatible');
    await fs.writeFile(`${f.file}.bak`, sealCredentialVault(JSON.stringify(legacy()), 'otro-perfil'));
    await expect(f.vault.prepareRecovery()).rejects.toThrow('autenticar');
    await fs.writeFile(`${f.file}.bak`, f.backup); vi.mocked(safeStorage.isEncryptionAvailable).mockReturnValue(false);
    await expect(f.vault.prepareRecovery()).rejects.toThrow('seguro');
  });

  it('rechaza secretos internos dañados aunque el sobre externo sea válido', async () => {
    const f = await missingVault(); const invalid = legacy(); invalid.credentials[0].passwordEncrypted = '?';
    await fs.writeFile(`${f.file}.bak`, sealCredentialVault(JSON.stringify(invalid), scope(f.file)));
    await expect(f.vault.prepareRecovery()).rejects.toThrow('credencial inválida');
    await expect(fs.stat(f.file)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it.each(['json', 'gcm', 'schema', 'secret'] as const)('recupera corrupción %s con copia cifrada de los bytes originales', async (kind) => {
    const f = await missingVault();
    const invalidSecret = legacy(); invalidSecret.credentials[0].passwordEncrypted = '?';
    const damaged = kind === 'secret' ? sealCredentialVault(JSON.stringify(invalidSecret), scope(f.file)) : kind === 'json' ? '{"metadata":"privada"' : kind === 'schema'
      ? sealCredentialVault(JSON.stringify({ version: 1, credentials: null }), scope(f.file))
      : JSON.stringify({ ...JSON.parse(f.backup), tag: Buffer.alloc(16).toString('base64') });
    await fs.writeFile(f.file, damaged);
    const prepared = await f.vault.prepareRecovery();
    expect(await fs.readFile(f.file, 'utf8')).toBe(damaged);
    expect((await fs.readdir(root)).some((name) => name.includes('.corrupt-'))).toBe(false);
    expect(await prepared.commit(() => undefined)).toBe(1);
    expect(await f.vault.list()).toEqual([f.metadata]);
    const archivedName = (await fs.readdir(root)).find((name) => name.includes('.corrupt-'))!;
    const archived = await fs.readFile(path.join(root, archivedName), 'utf8');
    expect(archived).not.toContain('metadata');
    const recovered = JSON.parse(safeStorage.decryptString(Buffer.from(JSON.parse(archived).protectedOriginal, 'base64')));
    expect(recovered.scope).toBe(scope(f.file));
    expect(Buffer.from(recovered.original, 'base64').toString('utf8')).toBe(damaged);
    expect(await fs.readFile(`${f.file}.bak`, 'utf8')).toBe(f.backup);
    expect(await f.vault.getAutosaveEnabled()).toBe(false);
  });

  it.each(['primary', 'rename', 'quota', 'io', 'valid'] as const)('conserva el principal ante fallo de recuperación: %s', async (mode) => {
    const f = await missingVault(); const damaged = '{dañado'; await fs.writeFile(f.file, damaged);
    if (mode === 'valid') {
      await fs.writeFile(f.file, f.backup); await expect(f.vault.prepareRecovery()).rejects.toThrow('es válido'); return;
    }
    const prepared = await f.vault.prepareRecovery();
    if (mode === 'primary') await fs.writeFile(f.file, '{otro');
    if (mode === 'rename') vi.spyOn(fs, 'rename').mockRejectedValueOnce(Object.assign(new Error('fallo'), { code: 'EACCES' }));
    if (mode === 'quota') for (let i = 0; i < 5; i++) await fs.writeFile(`${f.file}.corrupt-${i}`, 'copia de prueba');
    if (mode === 'io') vi.spyOn(fs, 'open').mockRejectedValueOnce(Object.assign(new Error('fallo'), { code: 'EACCES' }));
    await expect(prepared.commit(() => undefined)).rejects.toThrow();
    expect(await fs.readFile(f.file, 'utf8')).toBe(mode === 'primary' ? '{otro' : damaged);
    expect(await fs.readFile(`${f.file}.bak`, 'utf8')).toBe(f.backup);
    expect((await fs.readdir(root)).some((name) => name.endsWith('.tmp'))).toBe(false);
  });

  it.each(['remove', 'clear', 'error'] as const)('borrado incluye copias dañadas sin tocar otros archivos: %s', async (mode) => {
    const f = await missingVault(); await fs.writeFile(f.file, '{dañado');
    await (await f.vault.prepareRecovery()).commit(() => undefined);
    const archived = (await fs.readdir(root)).find((name) => name.includes('.corrupt-'))!;
    const foreign = path.join(root, 'otro.json.corrupt-aaaa1111-bbbb-4444-8888-cccc99999999');
    await fs.writeFile(foreign, 'conservar');
    if (mode === 'error') {
      const unlink = fs.unlink.bind(fs);
      vi.spyOn(fs, 'unlink').mockImplementation(async (filename) => {
        if (String(filename).endsWith(archived)) throw new Error('copia bloqueada');
        return unlink(filename);
      });
      await expect(f.vault.clearAll()).rejects.toThrow('copia bloqueada');
      expect(await f.vault.list()).toHaveLength(1);
    } else {
      if (mode === 'remove') expect(await f.vault.remove(f.metadata.id, fake.origin)).toBe(true);
      else expect(await f.vault.clearAll()).toBe(1);
      await expect(fs.stat(path.join(root, archived))).rejects.toMatchObject({ code: 'ENOENT' });
      expect(await f.vault.list()).toHaveLength(0);
    }
    expect(await fs.readFile(foreign, 'utf8')).toBe('conservar');
  });

  it('rechaza directorios y enlaces como principal sin modificar el respaldo', async () => {
    const f = await missingVault(); await fs.mkdir(f.file);
    await expect(f.vault.prepareRecovery()).rejects.toThrow('archivo regular');
    expect(await fs.readFile(`${f.file}.bak`, 'utf8')).toBe(f.backup);
  });

  it('cifra metadata y secreto, cambia clave/nonce y autentica el ámbito', () => {
    const plaintext = JSON.stringify(fake);
    const first = JSON.parse(sealCredentialVault(plaintext, 'perfil-a'));
    const second = JSON.parse(sealCredentialVault(plaintext, 'perfil-a'));
    expect(first).toMatchObject({ version: 2, algorithm: 'aes-256-gcm' });
    expect(first.iv).not.toBe(second.iv);
    expect(first.protectedKey).not.toBe(second.protectedKey);
    expect(openCredentialVault(first, 'perfil-a')).toBe(plaintext);
    expect(() => openCredentialVault(first, 'perfil-b')).toThrow('autenticar');
    for (const value of Object.values(fake)) expect(JSON.stringify(first)).not.toContain(value);
  });

  it.each(['ciphertext', 'iv', 'tag', 'protectedKey', 'version', 'algorithm', 'extra'] as const)('rechaza modificación de %s sin devolver datos parciales', (field) => {
    const value = JSON.parse(sealCredentialVault(JSON.stringify(fake), 'perfil'));
    if (field === 'extra') value.extra = 'no permitido';
    else if (field === 'version') value.version = 3;
    else if (field === 'algorithm') value.algorithm = 'aes-128-cbc';
    else {
      const bytes = Buffer.from(value[field], 'base64'); bytes[0] ^= 1;
      value[field] = bytes.toString('base64');
    }
    expect(() => openCredentialVault(value, 'perfil')).toThrow('autenticar');
  });

  it('migra v1 una sola vez, cifra el respaldo y conserva identidad y fechas', async () => {
    const file = path.join(root, 'credentials.json');
    const before = legacy();
    await fs.writeFile(file, JSON.stringify(before));
    const vault = new BrowserCredentialVault(file);
    expect(await vault.list()).toEqual([expect.objectContaining({ id, createdAt: before.credentials[0].createdAt })]);
    const migrated = await fs.readFile(file, 'utf8');
    expect(JSON.parse(migrated).version).toBe(2);
    expect(await decryptFile(file)).toEqual(before);
    expect(await decryptFile(`${file}.bak`, file)).toEqual(before);
    for (const value of [fake.origin, fake.username, fake.password]) {
      expect(migrated).not.toContain(value);
      expect(await fs.readFile(`${file}.bak`, 'utf8')).not.toContain(value);
    }
    expect(await new BrowserCredentialVault(file).resolveSecret(id, fake.origin)).toMatchObject({ password: fake.password });
    expect(await fs.readFile(file, 'utf8')).toBe(migrated);
  });

  it('conserva principal al fallar la migración y permite reintentar sin perder datos', async () => {
    const file = path.join(root, 'credentials.json');
    const original = JSON.stringify(legacy());
    await fs.writeFile(file, original);
    const rename = fs.rename.bind(fs);
    const fail = vi.spyOn(fs, 'rename').mockImplementation(async (from, to) => {
      if (String(to) === file) throw new Error('E/S ficticia');
      return rename(from, to);
    });
    const vault = new BrowserCredentialVault(file);
    await expect(vault.list()).rejects.toThrow();
    expect(await fs.readFile(file, 'utf8')).toBe(original);
    expect((await decryptFile(`${file}.bak`, file)).credentials).toHaveLength(1);
    expect((await fs.readdir(root)).some((entry) => entry.endsWith('.tmp'))).toBe(false);
    fail.mockRestore();
    expect(await vault.list()).toHaveLength(1);
    expect(JSON.parse(await fs.readFile(file, 'utf8')).version).toBe(2);
  });

  it('no restaura automáticamente corrupción ni reemplaza una versión futura', async () => {
    const file = path.join(root, 'credentials.json');
    const vault = new BrowserCredentialVault(file);
    await vault.save(fake.origin, fake);
    await vault.save(fake.origin, { username: fake.username, password: 'Actualizada-12!' });
    const backup = await fs.readFile(`${file}.bak`, 'utf8');
    for (const raw of ['{incompleto', JSON.stringify({ version: 999, credentials: [] })]) {
      await fs.writeFile(file, raw);
      await expect(vault.list()).rejects.toThrow();
      await expect(vault.save(fake.origin, fake)).rejects.toThrow();
      expect(await fs.readFile(file, 'utf8')).toBe(raw);
      expect(await fs.readFile(`${file}.bak`, 'utf8')).toBe(backup);
    }
  });

  it('no permite copiar una bóveda a otro perfil del mismo usuario del SO', async () => {
    const a = path.join(root, 'perfil-a', 'credentials.json');
    const b = path.join(root, 'perfil-b', 'credentials.json');
    await new BrowserCredentialVault(a).save(fake.origin, fake);
    await fs.mkdir(path.dirname(b), { recursive: true });
    await fs.copyFile(a, b);
    await expect(new BrowserCredentialVault(b).list()).rejects.toThrow('autenticar');
    expect(await new BrowserCredentialVault(a).list()).toHaveLength(1);
  });

  it('el borrado retira credenciales del principal y del respaldo', async () => {
    const file = path.join(root, 'credentials.json');
    const vault = new BrowserCredentialVault(file);
    const first = await vault.save(fake.origin, fake);
    await vault.save(fake.origin, { username: 'segunda', password: 'Otra-ficticia12!' });
    expect(await vault.remove(first.id, fake.origin)).toBe(true);
    expect((await decryptFile(`${file}.bak`, file)).credentials.map((entry: { username: string }) => entry.username)).toEqual(['segunda']);
    expect(await vault.clearAll()).toBe(1);
    expect((await decryptFile(file)).credentials).toEqual([]);
    expect((await decryptFile(`${file}.bak`, file)).credentials).toEqual([]);
  });

  it('una lectura que migra entra en la barrera y fija su destino antes de esperar', async () => {
    const file = path.join(root, 'credentials.json');
    let target = file;
    await fs.writeFile(file, JSON.stringify(legacy()));
    const original = fs.rename.bind(fs);
    let release!: () => void;
    const barrier = new Promise<void>((done) => { release = done; });
    const rename = vi.spyOn(fs, 'rename').mockImplementation(async (from, to) => { await barrier; return original(from, to); });
    const vault = new BrowserCredentialVault(() => target);
    const pending = vault.list();
    let flushed = false;
    const flush = vault.flush().then(() => { flushed = true; });
    target = path.join(root, 'other.json');
    await vi.waitFor(() => expect(rename).toHaveBeenCalled());
    expect(flushed).toBe(false);
    release();
    expect(await pending).toHaveLength(1); await flush;
    expect(flushed).toBe(true);
    await expect(fs.stat(target)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('sin almacén seguro no revela metadata ni migra archivos existentes', async () => {
    const file = path.join(root, 'credentials.json');
    const raw = JSON.stringify(legacy());
    await fs.writeFile(file, raw);
    vi.mocked(safeStorage.isEncryptionAvailable).mockReturnValue(false);
    await expect(new BrowserCredentialVault(file).list()).rejects.toThrow('seguro');
    expect(await fs.readFile(file, 'utf8')).toBe(raw);
    await expect(fs.stat(`${file}.bak`)).rejects.toMatchObject({ code: 'ENOENT' });
  });
});
