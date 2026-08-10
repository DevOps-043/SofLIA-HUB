import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { BrowserSitePermissionStore, normalizeOrigin } from '../integrated-browser/site-permissions';

const created: string[] = [];

function newStore(): BrowserSitePermissionStore {
  const filePath = path.join(os.tmpdir(), `soflia-site-permissions-${randomUUID()}.json`);
  created.push(filePath);
  return new BrowserSitePermissionStore(filePath);
}

afterEach(async () => {
  await Promise.all(created.splice(0).map((filePath) => fs.rm(filePath, { force: true })));
});

describe('BrowserSitePermissionStore', () => {
  it('aplica los valores por omision de cada permiso', async () => {
    const store = newStore();

    // Lo que abre un dispositivo o publica avisos se pregunta.
    await expect(store.resolve('https://example.com', 'camera')).resolves.toBe('ask');
    await expect(store.resolve('https://example.com', 'microphone')).resolves.toBe('ask');
    await expect(store.resolve('https://example.com', 'notifications')).resolves.toBe('ask');
    // Lo que solo cambia la presentacion no interrumpe.
    await expect(store.resolve('https://example.com', 'fullscreen')).resolves.toBe('granted');
    await expect(store.resolve('https://example.com', 'pointer-lock')).resolves.toBe('granted');
  });

  it('guarda por origen exacto y persiste entre instancias', async () => {
    const store = newStore();
    const filePath = created[created.length - 1];

    await store.set('https://meet.example/ruta?x=1', 'camera', 'granted');

    // El puerto y el esquema forman parte del origen; la ruta no.
    await expect(store.resolve('https://meet.example/otra', 'camera')).resolves.toBe('granted');
    await expect(store.resolve('http://meet.example', 'camera')).resolves.toBe('ask');
    await expect(store.resolve('https://meet.example:8443', 'camera')).resolves.toBe('ask');

    const reopened = new BrowserSitePermissionStore(filePath);
    await expect(reopened.resolve('https://meet.example', 'camera')).resolves.toBe('granted');
  });

  it('restablecer borra el origen y devuelve los valores por omision', async () => {
    const store = newStore();
    await store.set('https://example.com', 'microphone', 'denied');
    await store.set('https://example.com', 'notifications', 'granted');

    await store.reset('https://example.com');

    const listado = await store.list('https://example.com');
    expect(listado.microphone).toBe('ask');
    expect(listado.notifications).toBe('ask');
  });

  it('rechaza origenes y permisos que no puede administrar', async () => {
    const store = newStore();

    await expect(store.set('file:///C:/secreto', 'camera', 'granted')).rejects.toThrow(/origen/i);
    await expect(store.set('no-es-una-url', 'camera', 'granted')).rejects.toThrow(/origen/i);
    await expect(store.set('https://example.com', 'usb' as never, 'granted')).rejects.toThrow(/permiso/i);
    await expect(store.set('https://example.com', 'camera', 'quizas' as never)).rejects.toThrow(/estado/i);
    // Un esquema no web nunca resuelve a concedido, ni siquiera por omision.
    await expect(store.resolve('file:///C:/secreto', 'fullscreen')).resolves.toBe('denied');
  });

  it('sobrevive a un archivo corrupto o manipulado', async () => {
    const store = newStore();
    const filePath = created[created.length - 1];
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, '{ esto no es json', 'utf8');

    await expect(store.resolve('https://example.com', 'camera')).resolves.toBe('ask');

    const manipulado = newStore();
    const manipuladoPath = created[created.length - 1];
    await fs.writeFile(manipuladoPath, JSON.stringify({
      version: 1,
      origins: {
        'https://example.com': { camera: { state: 'concedido-total' }, microphone: { state: 'granted' } },
        'javascript:alert(1)': { camera: { state: 'granted' } },
      },
    }), 'utf8');

    // El estado invalido se descarta y el origen no web no se carga.
    await expect(manipulado.resolve('https://example.com', 'camera')).resolves.toBe('ask');
    await expect(manipulado.resolve('https://example.com', 'microphone')).resolves.toBe('granted');
  });

  it('resolveSync responde desde memoria una vez precargado', async () => {
    const store = newStore();
    await store.set('https://example.com', 'camera', 'granted');

    expect(store.resolveSync('https://example.com', 'camera')).toBe('granted');
    expect(store.resolveSync('https://otro.example', 'camera')).toBe('ask');
    expect(store.resolveSync('file:///C:/x', 'camera')).toBe('denied');
  });
});

describe('normalizeOrigin', () => {
  it('acepta solo HTTP(S) y descarta ruta, consulta y fragmento', () => {
    expect(normalizeOrigin('https://example.com/a/b?c=1#d')).toBe('https://example.com');
    expect(normalizeOrigin('http://localhost:5173/x')).toBe('http://localhost:5173');
    expect(normalizeOrigin('file:///C:/x')).toBeNull();
    expect(normalizeOrigin('about:blank')).toBeNull();
    expect(normalizeOrigin('')).toBeNull();
    expect(normalizeOrigin(42)).toBeNull();
  });
});
