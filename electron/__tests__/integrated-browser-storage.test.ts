import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { safeStorage } from 'electron';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { BrowserCredentialVault, BrowserHistoryStore } from '../integrated-browser';

let testRoot = '';

beforeEach(async () => {
  testRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'soflia-browser-storage-'));
  vi.mocked(safeStorage.isEncryptionAvailable).mockReturnValue(true);
});

afterEach(async () => {
  await fs.rm(testRoot, { recursive: true, force: true });
});

describe('persistencia privada del navegador integrado', () => {
  it('guarda historial, elimina credenciales de URL y conserva lineas validas', async () => {
    const file = path.join(testRoot, 'history.jsonl');
    const store = new BrowserHistoryStore(file);
    await store.record({ url: 'https://user:secret@example.com/ruta', title: ' Ejemplo\nprivado ' });
    await fs.appendFile(file, '{linea rota}\n', 'utf8');

    const entries = await store.list({ query: 'ejemplo', limit: 10 });
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ url: 'https://example.com/ruta', title: 'Ejemplo privado' });
    expect(await fs.readFile(file, 'utf8')).not.toContain('secret');

    await store.clear();
    expect(await store.list()).toEqual([]);
  });

  it('busca dominio y ruta sin hacer coincidir todas las URLs por https', async () => {
    const store = new BrowserHistoryStore(path.join(testRoot, 'history-search.jsonl'));
    await store.record({ url: 'https://www.google.com/', title: 'Google' });
    await store.record({ url: 'https://soflia.ai/aprender', title: 'SofLIA Learn' });

    expect((await store.list({ query: 's', limit: 10 })).map((entry) => entry.title)).toEqual(['SofLIA Learn']);
    expect((await store.list({ query: 'www.google', limit: 10 })).map((entry) => entry.title)).toEqual(['Google']);
    expect(await store.list({ query: 'https://', limit: 10 })).toHaveLength(2);
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
