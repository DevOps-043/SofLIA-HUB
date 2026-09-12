import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { safeStorage } from 'electron';
import { afterEach, describe, expect, it } from 'vitest';
import { BrowserSyncCrypto } from '../integrated-browser/sync-crypto';

const roots: string[] = [];
afterEach(() => Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true }))));

async function fixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'soflia-sync-'));
  roots.push(root);
  return { root, crypto: new BrowserSyncCrypto(path.join(root, 'key.json')) };
}

describe('BrowserSyncCrypto', () => {
  it('rechaza archivos enormes y envelopes abiertos sin reemplazar la clave', async () => {
    const f = await fixture(); const destination = path.join(f.root, 'key.json');
    for (const content of ['x'.repeat(8193), JSON.stringify({ version: 1, protectedKey: 'AA==', extra: true })]) {
      await fs.writeFile(destination, content);
      await expect(f.crypto.hasKey()).rejects.toThrow('dañada');
      await expect(f.crypto.initialize()).rejects.toThrow('dañada');
      expect(await fs.readFile(destination, 'utf8')).toBe(content);
    }
  });
  it('cifra, autentica y recupera la clave sin persistirla en claro', async () => {
    const first = await fixture();
    const { recoveryCode } = await first.crypto.initialize();
    if (!recoveryCode) throw new Error('La primera inicialización necesita código.');
    const payload = [{ id: 'b1', title: 'Privado', url: 'https://example.com/' }];
    const envelope = await first.crypto.encrypt({ category: 'bookmarks', payload });
    expect(envelope.ciphertext).not.toContain('Privado');
    expect(await first.crypto.decrypt(envelope)).toEqual(payload);
    // base64url admite guiones: split podía comparar sólo una letra aleatoria.
    const encodedKey = /^SL1-([A-Za-z0-9_-]{43})-[a-f0-9]{10}$/.exec(recoveryCode)?.[1];
    expect(encodedKey).toHaveLength(43);
    const keyBase64 = Buffer.from(encodedKey!, 'base64url').toString('base64');
    const persisted = await fs.readFile(path.join(first.root, 'key.json'), 'utf8');
    expect(persisted).not.toContain(encodedKey);
    expect(persisted).not.toContain(keyBase64);
    const protectedKey = JSON.parse(persisted).protectedKey as string;
    expect(safeStorage.decryptString(Buffer.from(protectedKey, 'base64'))).toBe(keyBase64);

    const second = await fixture();
    await second.crypto.restore(recoveryCode);
    expect(await second.crypto.decrypt(envelope)).toEqual(payload);
  });

  it('rechaza secretos antes de cifrar', async () => {
    const { crypto } = await fixture();
    await crypto.initialize();
    await expect(crypto.encrypt({ category: 'bookmarks', payload: { url: 'https://example.com/', password: 'no' } })).rejects.toThrow('no puede sincronizarse');
    await expect(crypto.encrypt({ category: 'cookies', payload: [] })).rejects.toThrow('categoría');
  });

  it('rechaza alteraciones del ciphertext', async () => {
    const { crypto } = await fixture();
    await crypto.initialize();
    const envelope = await crypto.encrypt({ category: 'settings', payload: { theme: 'dark' } });
    envelope.ciphertext = Buffer.from('alterado').toString('base64');
    await expect(crypto.decrypt(envelope)).rejects.toThrow('autenticación');
  });

  it('no reemplaza una clave dañada ni permite reemplazar una clave existente por otra', async () => {
    const first = await fixture();
    const second = await fixture();
    const { recoveryCode } = await second.crypto.initialize();
    await first.crypto.initialize();
    const before = await fs.readFile(path.join(first.root, 'key.json'), 'utf8');
    await expect(first.crypto.restore(recoveryCode!)).rejects.toThrow('clave diferente');
    expect(await fs.readFile(path.join(first.root, 'key.json'), 'utf8')).toBe(before);
    await fs.writeFile(path.join(first.root, 'key.json'), 'archivo dañado');
    await expect(first.crypto.initialize()).rejects.toThrow('dañada');
    expect(await fs.readFile(path.join(first.root, 'key.json'), 'utf8')).toBe('archivo dañado');
  });

  it('genera una sola clave concurrente y sólo entrega el código una vez', async () => {
    const first = await fixture();
    const second = new BrowserSyncCrypto(path.join(first.root, 'key.json'));
    const results = await Promise.all([first.crypto.initialize(), second.initialize(), first.crypto.initialize()]);
    expect(results.filter((result) => result.recoveryCode)).toHaveLength(1);
    expect(await second.decrypt(await first.crypto.encrypt({ category: 'settings', payload: { theme: 'dark' } }))).toEqual({ theme: 'dark' });
  });

  it('rechaza objetos arbitrarios y elimina parámetros sensibles de las URLs', async () => {
    const { crypto } = await fixture();
    await crypto.initialize();
    await expect(crypto.encrypt({ category: 'settings', payload: { credentialsBySite: 'secreto' } })).rejects.toThrow('campos no soportados');
    await expect(crypto.encrypt({ category: 'tabs', payload: [{ id: 't1', url: 'https://user:secret@example.com' }] })).rejects.toThrow('URL');
    const envelope = await crypto.encrypt({ category: 'tabs', payload: [{ id: 't1', url: 'https://example.com/page?session=secret#token' }] });
    expect(await crypto.decrypt(envelope)).toEqual([{ id: 't1', url: 'https://example.com/page' }]);
  });
});
