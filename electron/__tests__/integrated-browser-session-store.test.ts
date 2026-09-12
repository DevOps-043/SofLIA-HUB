import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import promises from 'node:fs/promises';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BrowserSessionStore, parseBrowserSession } from '../integrated-browser/session-store';
import type { BrowserSessionSnapshot } from '../integrated-browser/platform-types';

const roots: string[] = [];
afterEach(() => {
  vi.restoreAllMocks();
  roots.splice(0).forEach((root) => fs.rmSync(root, { recursive: true, force: true }));
});

function location(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'soflia-session-'));
  roots.push(root);
  return path.join(root, 'session.json');
}

function snapshot(): BrowserSessionSnapshot {
  return {
    version: 2, savedAt: new Date().toISOString(), cleanExit: false, activeTabId: 'tab-1', viewMode: 'single', tabLayout: 'horizontal',
    primaryTabId: 'tab-1', secondaryTabId: null, detachedTabIds: [],
    groups: [{ id: 'group-1', name: 'Investigación', color: 'blue', collapsed: false }],
    tabs: [{ id: 'tab-1', url: 'https://example.com/', title: 'Ejemplo', pinned: true, muted: false, groupId: 'group-1', position: 0 }],
  };
}

describe('BrowserSessionStore', () => {
  it('escribe atómicamente y conserva respaldo de la versión anterior', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'soflia-session-'));
    roots.push(root);
    const file = path.join(root, 'session.json');
    const store = new BrowserSessionStore(file);
    await store.save(snapshot());
    await store.save({ ...snapshot(), cleanExit: true });
    expect((await store.load())?.cleanExit).toBe(true);
    expect(fs.existsSync(`${file}.bak`)).toBe(true);
  });

  it('aísla un archivo corrupto sin impedir el arranque', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'soflia-session-'));
    roots.push(root);
    const file = path.join(root, 'session.json');
    fs.writeFileSync(file, '{roto');
    const store = new BrowserSessionStore(file);
    expect(await store.load()).toBeNull();
    expect(fs.readdirSync(root).some((name) => name.startsWith('session.json.corrupt-'))).toBe(true);
  });

  it('rechaza protocolos y referencias de grupo no verificadas', () => {
    expect(() => parseBrowserSession(JSON.stringify({ ...snapshot(), tabs: [{ ...snapshot().tabs[0], url: 'file:///secreto' }] }))).toThrow();
    expect(() => parseBrowserSession(JSON.stringify({ ...snapshot(), tabs: [{ ...snapshot().tabs[0], groupId: 'ajeno' }] }))).toThrow();
  });

  it.each(['ausente', 'corrupto'])('recupera el respaldo con principal %s sin consumirlo', async (condition) => {
    const file = location();
    const original = snapshot();
    fs.writeFileSync(`${file}.bak`, JSON.stringify(original));
    if (condition === 'corrupto') fs.writeFileSync(file, '{roto');
    const store = new BrowserSessionStore(file);
    expect(await store.load()).toEqual(original);
    expect(await new BrowserSessionStore(file).load()).toEqual(original);
    await store.save({ ...original, cleanExit: true });
    expect(JSON.parse(fs.readFileSync(`${file}.bak`, 'utf8'))).toEqual(original);
    expect((await store.load())?.cleanExit).toBe(true);
  });

  it('no deja un intervalo sin principal si falla el reemplazo', async () => {
    const file = location();
    const original = snapshot();
    const store = new BrowserSessionStore(file);
    await store.save(original);
    const rename = promises.rename.bind(promises);
    vi.spyOn(promises, 'rename').mockImplementation(async (from, to) => {
      if (to === file) {
        expect(JSON.parse(fs.readFileSync(file, 'utf8'))).toEqual(original);
        throw Object.assign(new Error('disco ocupado'), { code: 'EPERM' });
      }
      await rename(from, to);
    });
    await expect(store.save({ ...original, cleanExit: true })).rejects.toThrow('disco ocupado');
    expect(await store.load()).toEqual(original);
    expect(fs.readdirSync(path.dirname(file)).some((name) => name.endsWith('.tmp'))).toBe(false);
    vi.restoreAllMocks();
    await store.save({ ...original, cleanExit: true });
    expect((await store.load())?.cleanExit).toBe(true);
  });

  it('migra v1 en memoria de forma idempotente y conserva la fuente al primer guardado', async () => {
    const file = location();
    const legacy = { ...snapshot(), version: 1, primaryTabId: undefined, secondaryTabId: undefined, detachedTabIds: undefined };
    const raw = JSON.stringify(legacy);
    fs.writeFileSync(file, raw);
    const store = new BrowserSessionStore(file);
    const migrated = (await store.load())!;
    expect(migrated.version).toBe(2);
    expect(parseBrowserSession(JSON.stringify(migrated))).toEqual(migrated);
    expect(fs.readFileSync(file, 'utf8')).toBe(raw);
    await store.save(migrated);
    expect(fs.readFileSync(`${file}.bak`, 'utf8')).toBe(raw);
  });

  it('no interpreta una versión futura como corrupción ni la sobrescribe', async () => {
    const file = location();
    const raw = JSON.stringify({ ...snapshot(), version: 3 });
    fs.writeFileSync(file, raw);
    fs.writeFileSync(`${file}.bak`, JSON.stringify(snapshot()));
    const store = new BrowserSessionStore(file);
    await expect(store.load()).rejects.toThrow(/versión/);
    await expect(store.save(snapshot())).rejects.toThrow(/versión/);
    await expect(store.clear()).rejects.toThrow(/versión/);
    expect(fs.readFileSync(file, 'utf8')).toBe(raw);
    expect(fs.readdirSync(path.dirname(file))).toHaveLength(2);
  });

  it('no renombra un archivo por un fallo de permisos de lectura', async () => {
    const file = location();
    fs.writeFileSync(file, JSON.stringify(snapshot()));
    vi.spyOn(promises, 'open').mockRejectedValueOnce(Object.assign(new Error('denegado'), { code: 'EACCES' }));
    await expect(new BrowserSessionStore(file).load()).rejects.toThrow('denegado');
    expect(fs.existsSync(file)).toBe(true);
    expect(fs.readdirSync(path.dirname(file))).toEqual(['session.json']);
  });

  it('serializa guardado, descarte y lectura entre instancias sin resucitar el respaldo', async () => {
    const file = location();
    const first = new BrowserSessionStore(file);
    const second = new BrowserSessionStore(file);
    const saving = first.save(snapshot());
    const clearing = second.clear();
    const reading = first.load();
    await Promise.all([saving, clearing]);
    expect((await reading)?.tabs).toEqual([]);
    expect((await new BrowserSessionStore(file).load())?.tabs).toEqual([]);
    expect(fs.existsSync(`${file}.bak`)).toBe(false);
  });

  it('la lápida evita recuperación aunque falle eliminar el respaldo', async () => {
    const file = location();
    const store = new BrowserSessionStore(file);
    await store.save(snapshot());
    const unlink = promises.unlink.bind(promises);
    vi.spyOn(promises, 'unlink').mockImplementation(async (target) => {
      if (target === `${file}.bak`) throw new Error('respaldo ocupado');
      return unlink(target);
    });
    await expect(store.clear()).rejects.toThrow('respaldo ocupado');
    expect((await new BrowserSessionStore(file).load())?.tabs).toEqual([]);
  });

  it('captura el perfil al invocar y no al resolver la cola de escritura', async () => {
    const first = location();
    const second = location();
    let current = first;
    const store = new BrowserSessionStore(() => current);
    const saving = store.save(snapshot());
    current = second;
    await saving;
    expect(await store.load()).toBeNull();
    expect((await new BrowserSessionStore(first).load())?.tabs).toHaveLength(1);
    const clearing = new BrowserSessionStore(() => current).clear();
    current = first;
    await clearing;
    expect((await store.load())?.tabs).toHaveLength(1);
  });

  it('excluye extras sensibles del contrato persistido', async () => {
    const file = location();
    const input = { ...snapshot(), cookies: 'NO-COPIAR', tabs: [{ ...snapshot().tabs[0], formData: 'NO-COPIAR' }] };
    await new BrowserSessionStore(file).save(input);
    expect(fs.readFileSync(file, 'utf8')).not.toContain('NO-COPIAR');
  });

  it.each([
    { savedAt: 'no-fecha' }, { tabs: [snapshot().tabs[0], snapshot().tabs[0]] },
    { groups: [snapshot().groups[0], snapshot().groups[0]] }, { detachedTabIds: ['ajena'] },
    { detachedTabIds: ['tab-1'] }, { secondaryTabId: 'tab-1', viewMode: 'split' },
    { primaryTabId: 'ajena' }, { viewMode: 'split' },
    { tabs: [{ ...snapshot().tabs[0], url: 'https://usuario:clave@example.com/' }] },
  ])('rechaza metadata inválida: %j', (invalid) => {
    expect(() => parseBrowserSession(JSON.stringify({ ...snapshot(), ...invalid }))).toThrow();
  });

  it('aplica la cuota antes de parsear y usa respaldo ante un archivo enorme', async () => {
    const file = location();
    fs.writeFileSync(file, ' '.repeat(1_000_001));
    fs.writeFileSync(`${file}.bak`, JSON.stringify(snapshot()));
    expect((await new BrowserSessionStore(file).load())?.tabs).toHaveLength(1);
    expect(() => parseBrowserSession(' '.repeat(1_000_001))).toThrow(/cuota/);
  });
});
