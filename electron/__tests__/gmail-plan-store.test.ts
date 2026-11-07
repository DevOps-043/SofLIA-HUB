import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { GmailPlanStore } from '../gmail/plan-storage';
import { replacePrivateFile } from '../storage/private-files';
import { cipher, owner, guard, plan } from './gmail-plans/fixtures';

let root: string;
const directory = (account = owner) => path.join(root, 'gmail-private-plans', createHash('sha256').update(JSON.stringify(account)).digest('hex'));
const store = (crypto = cipher(), replace?: typeof replacePrivateFile) => new GmailPlanStore({ root: () => root, cipher: crypto, replace });
beforeEach(async () => { root = await fs.mkdtemp(path.join(os.tmpdir(), 'soflia-plan-store-')); });
afterEach(async () => { vi.restoreAllMocks(); await fs.rm(root, { recursive: true, force: true }); });

describe('Custodia privada de planes Gmail', () => {
  it('cifra datos y restaura el contrato sin PII en nombres o bytes', async () => {
    const storage = store(); const value = plan(); await storage.account(owner).save(value, guard);
    expect(await storage.account(owner).load(value.id, guard)).toEqual(value);
    const bytes = await fs.readFile(path.join(directory(), value.id + '.bin'));
    expect(bytes.toString()).not.toMatch(/Empresa|usuario-A|cuenta-a|in:inbox|msg-0/);
    expect(await fs.readdir(path.join(root, 'gmail-private-plans'))).toEqual([path.basename(directory())]);
  });
  it.each([{ userId: 'usuario-B', email: owner.email }, { userId: owner.userId, email: 'cuenta-b@example.test' }])('separa usuario y cuenta: %j', async other => {
    const storage = store(); const value = plan(); await storage.account(owner).save(value, guard);
    await expect(storage.account(other).load(value.id, guard)).rejects.toThrow();
    await fs.copyFile(path.join(directory(), value.id + '.bin'), path.join(directory(other), value.id + '.bin'));
    await expect(storage.account(other).load(value.id, guard)).rejects.toThrow('no pertenece');
  });
  it.each(['../../fuera', 'gmail-plan-../../fuera', 'C:\\otro\\plan', 'gmail-plan-heredado'])('rechaza IDs antes de tocar el directorio: %s', async id => {
    await expect(store().account(owner).load(id, guard)).rejects.toThrow();
    expect(await fs.readdir(root)).toEqual([]);
  });
  it('conserva legado sin leerlo ni atribuirlo a la cuenta', async () => {
    const legacy = path.join(root, 'gmail-organization-plans'); await fs.mkdir(legacy);
    const data = '{"status":"applied","asunto":"privado"}'; await fs.writeFile(path.join(legacy, 'heredado.json'), data);
    expect(await store().account(owner).latest(guard)).toBeNull();
    expect(await fs.readFile(path.join(legacy, 'heredado.json'), 'utf8')).toBe(data);
  });
  it('no usa fallback plano ni escribe si el cifrado no está disponible', async () => {
    const crypto = cipher(); vi.mocked(crypto.available).mockResolvedValue(false);
    await expect(store(crypto).account(owner).save(plan(), guard)).rejects.toThrow('cifrado');
    expect(await fs.readdir(root)).toEqual([]);
  });
  it('un fallo de publicación conserva bytes anteriores y limpia el temporal cifrado', async () => {
    const crypto = cipher(); const value = plan(); const storage = store(crypto); await storage.account(owner).save(value, guard);
    const file = path.join(directory(), value.id + '.bin'); const before = await fs.readFile(file);
    vi.spyOn(fs, 'rename').mockRejectedValueOnce(new Error('EACCES ficticio'));
    await expect(storage.account(owner).save({ ...value, queryUsed: 'consulta nueva' }, guard)).rejects.toThrow();
    expect(await fs.readFile(file)).toEqual(before); expect(await fs.readdir(directory())).toEqual([value.id + '.bin']);
  });
  it('conserva un cifrado corrupto y no selecciona otro plan al encontrarlo', async () => {
    const storage = store(); const value = plan(); await storage.account(owner).save(value, guard);
    const file = path.join(directory(), value.id + '.bin'); await fs.writeFile(file, 'corrupto');
    await expect(storage.account(owner).load(value.id, guard)).rejects.toThrow();
    await expect(storage.account(owner).latest(guard)).rejects.toThrow();
    expect(await fs.readFile(file, 'utf8')).toBe('corrupto');
  });
  it('exige un ID explícito cuando dos planes tienen la misma fecha de aplicación', async () => {
    const account = store().account(owner);
    const first = plan(0), second = plan(0);
    const appliedAt = '2026-10-22T12:00:00.000Z';
    for (const value of [first, second]) {
      value.status = 'applied';
      value.applyResult = { appliedAt, labelsCreated: [], labelsReused: [], messageChanges: {},
        removeFromInbox: true, messagesLabeled: 0, completedGroups: [] };
      await account.save(value, guard);
    }
    await expect(account.latest(guard)).rejects.toThrow('ambigua');
    expect((await account.load(first.id, guard)).id).toBe(first.id);
    expect((await account.load(second.id, guard)).id).toBe(second.id);
  });
  it('rechaza un directorio base enlazado antes de crear el directorio de cuenta', async () => {
    const outside = path.join(root, 'destino'); await fs.mkdir(outside);
    await fs.symlink(outside, path.join(root, 'gmail-private-plans'), process.platform === 'win32' ? 'junction' : 'dir');
    await expect(store().account(owner).save(plan(), guard)).rejects.toThrow('Directorio');
    expect(await fs.readdir(outside)).toEqual([]);
  });
  it('serializa por exclusión entre instancias y libera la cuenta después de un fallo', async () => {
    const first = store().account(owner), second = store().account(owner);
    let release!: () => void; const held = new Promise<void>(resolve => { release = resolve; });
    const running = first.exclusive(() => held);
    await expect(second.exclusive(async () => {})).rejects.toThrow('ejecución'); release(); await running;
    await expect(first.exclusive(async () => { throw new Error('fallo'); })).rejects.toThrow('fallo');
    await expect(second.exclusive(async () => 'libre')).resolves.toBe('libre');
  });
  it('rechaza un plan con referencias o conteos inconsistentes sin reemplazarlo', async () => {
    const storage = store(); const value = plan(); await storage.account(owner).save(value, guard);
    const invalid = { ...value, groups: [{ ...value.groups[0], count: 3 }] };
    await expect(storage.account(owner).save(invalid, guard)).rejects.toThrow();
    expect(await storage.account(owner).load(value.id, guard)).toEqual(value);
  });

  it('una copia del cifrado con otro ID no suplanta el plan solicitado', async () => {
    const storage = store(); const value = plan(); const other = plan(); await storage.account(owner).save(value, guard);
    await fs.copyFile(path.join(directory(), value.id + '.bin'), path.join(directory(), other.id + '.bin'));
    await expect(storage.account(owner).load(other.id, guard)).rejects.toThrow('no pertenece');
  });

  it('rota el cifrado sin cambiar owner o contenido del plan', async () => {
    const crypto = cipher(); const storage = store(crypto); const value = plan(); await storage.account(owner).save(value, guard);
    const file = path.join(directory(), value.id + '.bin'); const before = await fs.readFile(file);
    const decrypt = crypto.decrypt;
    crypto.decrypt = async bytes => ({ ...await decrypt(bytes), shouldReEncrypt: true });
    expect(await storage.account(owner).load(value.id, guard)).toEqual(value);
    expect(await fs.readFile(file)).not.toEqual(before);
  });

  it('limita a cien planes sin borrar historial ni impedir actualizar uno existente', async () => {
    const storage = store(); const account = storage.account(owner); const first = plan(0);
    await account.save(first, guard);
    for (let count = 1; count < 100; count++) await account.save(plan(0), guard);
    await expect(account.save(plan(0), guard)).rejects.toThrow('cuota');
    await account.save({ ...first, queryUsed: 'consulta actualizada' }, guard);
    expect((await account.load(first.id, guard)).queryUsed).toBe('consulta actualizada');
    expect(await fs.readdir(directory())).toHaveLength(100);
  });

  it('rechaza JSON excesivo antes de cifrar/publicar y conserva el plan anterior', async () => {
    const crypto = cipher(); const storage = store(crypto); const value = plan(1000); await storage.account(owner).save(value, guard);
    const large = structuredClone(value); large.status = 'applying';
    large.applyResult = { appliedAt: new Date().toISOString(), labelsCreated: [], labelsReused: [], removeFromInbox: true,
      messagesLabeled: 1000, completedGroups: [], messageChanges: Object.fromEntries(value.groups[0].messageIds.map(id => [id,
        { addedLabelIds: [], removedLabelIds: [], expectedLabelIds: Array.from({ length: 30 }, (_, index) => 'L' + index + 'x'.repeat(120)) }])) };
    const encrypted = vi.mocked(crypto.encrypt).mock.calls.length;
    await expect(storage.account(owner).save(large, guard)).rejects.toThrow('cuota');
    expect(vi.mocked(crypto.encrypt).mock.calls.length).toBe(encrypted);
    expect((await storage.account(owner).load(value.id, guard)).status).toBe('preview');
  });
});
