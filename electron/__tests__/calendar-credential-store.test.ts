import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { CalendarCredentialStore, type CalendarCipher } from '../calendar/credential-store';
import { MAX_CREDENTIAL_BYTES, replaceCredentialFile } from '../calendar/credential-files';
import type { CalendarConnection } from '../calendar/types';

let root: string;
const assert = () => {};
const connection = (userId = 'A', token = 'credencial-ficticia'): CalendarConnection => ({
  userId, provider: 'google', email: 'prueba@example.test', accessToken: token,
  refreshToken: 'renovacion-ficticia', tokenExpiry: new Date('2026-10-22T18:00:00Z'), isActive: true,
});
const ownerFile = (owner: string) => path.join(root, 'calendar-credentials', createHash('sha256').update(owner).digest('hex') + '.bin');
const legacyFile = () => path.join(root, 'calendar-connections.json');
function cipher(): CalendarCipher {
  const key = randomBytes(32);
  return {
    available: vi.fn(async () => true),
    encrypt: vi.fn(async value => {
      const iv = randomBytes(12); const crypto = createCipheriv('aes-256-gcm', key, iv);
      return Buffer.concat([iv, crypto.update(value, 'utf8'), crypto.final(), crypto.getAuthTag()]);
    }),
    decrypt: vi.fn(async value => {
      const crypto = createDecipheriv('aes-256-gcm', key, value.subarray(0, 12));
      crypto.setAuthTag(value.subarray(-16));
      return { result: Buffer.concat([crypto.update(value.subarray(12, -16)), crypto.final()]).toString('utf8'), shouldReEncrypt: false };
    }),
  };
}
const store = (crypto = cipher(), replace?: typeof replaceCredentialFile) => new CalendarCredentialStore({ root: () => root, cipher: crypto, replace });
beforeEach(async () => { root = await fs.mkdtemp(path.join(os.tmpdir(), 'soflia-calendar-custody-test-')); });
afterEach(async () => { await fs.rm(root, { recursive: true, force: true }); });

describe('Custodia privada del calendario con archivos reales y credenciales ficticias', () => {
  it('guarda y restaura fechas sin tokens ni PII en bytes o nombres de archivos', async () => {
    const storage = store(); const entry = connection();
    await storage.save('A', [entry], assert);
    expect(await storage.load('A', assert)).toEqual([entry]);
    const bytes = await fs.readFile(ownerFile('A'));
    expect(bytes.toString()).not.toMatch(/credencial-ficticia|renovacion-ficticia|prueba@example/);
    expect(await fs.readdir(path.dirname(ownerFile('A')))).toEqual([path.basename(ownerFile('A'))]);
  });
  it('no comparte conexiones entre A y B ni acepta copiar un cifrado a otro propietario', async () => {
    const storage = store();
    await storage.save('A', [connection()], assert);
    expect(await storage.load('B', assert)).toEqual([]);
    await fs.copyFile(ownerFile('A'), ownerFile('B'));
    await expect(storage.load('B', assert)).rejects.toThrow('Propietario');
  });
  it('sella todo el legado, conserva huérfanos e importa sólo el dueño exacto', async () => {
    const storage = store();
    const other = { ...connection('B'), provider: 'microsoft' as const };
    await fs.writeFile(legacyFile(), JSON.stringify([connection(), other, { ...connection(''), accessToken: 'huerfano-ficticio' }]));
    expect(await storage.load('A', assert)).toEqual([connection()]);
    expect(await storage.load('B', assert)).toEqual([other]);
    const bytes = (await fs.readFile(legacyFile())).toString();
    expect(bytes).toContain('SOFLIA-CALENDAR-LEGACY-1');
    expect(bytes).not.toMatch(/fictici|example|refreshToken/);
  });
  it('no reactiva un registro inactivo ni resucita conexiones desconectadas desde el legado', async () => {
    const crypto = cipher(); const storage = store(crypto);
    await fs.writeFile(legacyFile(), JSON.stringify([{ ...connection(), isActive: false }]));
    expect(await storage.load('A', assert)).toMatchObject([{ isActive: false }]);
    await storage.save('A', [], assert);
    expect(await store(crypto).load('A', assert)).toEqual([]);
  });
  it('un archivo privado ilegible no habilita fallback al legado', async () => {
    const storage = store();
    await fs.writeFile(legacyFile(), JSON.stringify([connection()]));
    await storage.load('A', assert);
    await fs.writeFile(ownerFile('A'), 'archivo-corrupto');
    await expect(storage.load('A', assert)).rejects.toThrow('Formato');
  });
  it('sin backend seguro conserva el legado intacto y no escribe credenciales', async () => {
    const crypto = cipher(); vi.mocked(crypto.available).mockResolvedValue(false);
    const original = JSON.stringify([connection()]); await fs.writeFile(legacyFile(), original);
    await expect(store(crypto).load('A', assert)).rejects.toThrow('cifrado seguro');
    expect(await fs.readFile(legacyFile(), 'utf8')).toBe(original);
    expect(crypto.encrypt).not.toHaveBeenCalled();
    expect(await fs.readdir(root)).toEqual(['calendar-connections.json']);
  });
  it('un fallo de cifrado no altera el legado', async () => {
    const crypto = cipher(); vi.mocked(crypto.encrypt).mockRejectedValue(new Error('Fallo simulado'));
    const original = JSON.stringify([connection()]); await fs.writeFile(legacyFile(), original);
    await expect(store(crypto).load('A', assert)).rejects.toThrow();
    expect(await fs.readFile(legacyFile(), 'utf8')).toBe(original);
  });
  it('un fallo al reemplazar conserva el archivo privado anterior', async () => {
    const crypto = cipher(); await store(crypto).save('A', [connection()], assert);
    const failing = store(crypto, async () => { throw new Error('Disco simulado'); });
    await expect(failing.save('A', [connection('A', 'nuevo-ficticio')], assert)).rejects.toThrow();
    expect(await store(crypto).load('A', assert)).toEqual([connection()]);
  });
  it('descarta un temporal cifrado si la sesión se revoca antes de publicar', async () => {
    const file = path.join(root, 'archivo.bin'); await fs.writeFile(file, 'version-anterior');
    let checks = 0;
    await expect(replaceCredentialFile(file, Buffer.from('cifrado-ficticio'), () => { if (++checks > 1) throw new Error('Revocado'); })).rejects.toThrow('Revocado');
    expect(await fs.readFile(file, 'utf8')).toBe('version-anterior');
    expect(await fs.readdir(root)).toEqual(['archivo.bin']);
  });
  it('serializa escrituras y conserva la más reciente, sin perder el uso de la cola tras un error', async () => {
    const crypto = cipher(); const encrypt = vi.mocked(crypto.encrypt).getMockImplementation()!;
    let finish!: () => void;
    vi.mocked(crypto.encrypt).mockImplementationOnce(async value => { await new Promise<void>(resolve => { finish = resolve; }); return encrypt(value); });
    const storage = store(crypto);
    const first = storage.save('A', [connection('A', 'primero-ficticio')], assert);
    const second = storage.save('A', [connection('A', 'segundo-ficticio')], assert);
    await vi.waitFor(() => expect(finish).toBeTypeOf('function'));
    finish(); await Promise.all([first, second]);
    expect(await storage.load('A', assert)).toMatchObject([{ accessToken: 'segundo-ficticio' }]);
    await expect(storage.load('A', () => { throw new Error('Revocado'); })).rejects.toThrow();
    expect(await storage.load('A', assert)).toHaveLength(1);
  });
  it('revalida después de cifrar y no persiste un resultado de sesión caducada', async () => {
    const crypto = cipher(); const encrypt = vi.mocked(crypto.encrypt).getMockImplementation()!;
    let valid = true;
    vi.mocked(crypto.encrypt).mockImplementation(async value => { const result = await encrypt(value); valid = false; return result; });
    await expect(store(crypto).save('A', [connection()], () => { if (!valid) throw new Error('Revocado'); })).rejects.toThrow('Revocado');
    expect(await fs.readdir(root)).toEqual([]);
  });
  it('rechaza archivos excesivos antes de descifrar', async () => {
    const crypto = cipher(); await fs.mkdir(path.dirname(ownerFile('A')));
    await fs.writeFile(ownerFile('A'), Buffer.alloc(MAX_CREDENTIAL_BYTES + 1));
    await expect(store(crypto).load('A', assert)).rejects.toThrow('inválido');
    expect(crypto.decrypt).not.toHaveBeenCalled();
  });
  it.each(['dueño', 'duplicado', 'fecha', 'campo'])('rechaza contenido no contractual: %s', mode => {
    const storage = store();
    const entry = mode === 'dueño' ? connection('B') : mode === 'fecha' ? { ...connection(), tokenExpiry: new Date('invalida') }
      : mode === 'campo' ? { ...connection(), privado: 'dato-ficticio' } : connection();
    expect(() => storage.save('A', mode === 'duplicado' ? [entry, entry] : [entry], assert)).toThrow();
  });
  it('recifra cuando el proveedor indica rotación de clave', async () => {
    const crypto = cipher(); const storage = store(crypto);
    await storage.save('A', [connection()], assert);
    const decrypt = vi.mocked(crypto.decrypt).getMockImplementation()!;
    vi.mocked(crypto.decrypt).mockImplementation(async value => ({ ...await decrypt(value), shouldReEncrypt: true }));
    vi.mocked(crypto.encrypt).mockClear();
    expect(await storage.load('A', assert)).toEqual([connection()]);
    expect(crypto.encrypt).toHaveBeenCalledTimes(1);
  });
});
