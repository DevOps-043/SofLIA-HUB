import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { BrowserHistoryStore } from '../integrated-browser/browser-history-store';

const created: string[] = [];

function newStore(): BrowserHistoryStore {
  const filePath = path.join(os.tmpdir(), `soflia-history-${randomUUID()}.jsonl`);
  created.push(filePath);
  return new BrowserHistoryStore(filePath);
}

afterEach(async () => {
  await Promise.all(created.splice(0).map((filePath) => fs.rm(filePath, { force: true })));
});

/** El historial es el único dato del navegador que puede acotarse por fecha. */
describe('borrado del historial por rango', () => {
  async function seed(store: BrowserHistoryStore): Promise<void> {
    await store.record({ url: 'https://antigua.example/', visitedAt: '2026-08-01T10:00:00.000Z' });
    await store.record({ url: 'https://media.example/', visitedAt: '2026-08-11T10:00:00.000Z' });
    await store.record({ url: 'https://reciente.example/', visitedAt: '2026-08-12T11:30:00.000Z' });
  }

  it('conserva lo anterior al inicio del rango y quita lo posterior', async () => {
    const store = newStore();
    await seed(store);

    await expect(store.clearSince('2026-08-11T00:00:00.000Z')).resolves.toBe(2);

    const restantes = await store.list({ limit: 50 });
    expect(restantes.map((entry) => entry.url)).toEqual(['https://antigua.example/']);
  });

  it('borra todo cuando el rango es nulo', async () => {
    const store = newStore();
    await seed(store);

    await expect(store.clearSince(null)).resolves.toBe(3);
    await expect(store.list({ limit: 50 })).resolves.toEqual([]);
  });

  it('no quita nada cuando ninguna visita cae en el rango', async () => {
    const store = newStore();
    await seed(store);

    await expect(store.clearSince('2026-09-01T00:00:00.000Z')).resolves.toBe(0);
    await expect(store.list({ limit: 50 })).resolves.toHaveLength(3);
  });

  it('sobre un historial vacio devuelve cero sin fallar', async () => {
    await expect(newStore().clearSince('2026-08-01T00:00:00.000Z')).resolves.toBe(0);
    await expect(newStore().clearSince(null)).resolves.toBe(0);
  });

  it('rechaza una fecha invalida antes de tocar el archivo', async () => {
    const store = newStore();
    await seed(store);

    await expect(store.clearSince('ayer por la tarde')).rejects.toThrow('no es una fecha valida');
    await expect(store.list({ limit: 50 })).resolves.toHaveLength(3);
  });

  it('la entrada justo en el limite se considera dentro del rango y se borra', async () => {
    const store = newStore();
    await store.record({ url: 'https://limite.example/', visitedAt: '2026-08-11T00:00:00.000Z' });

    await expect(store.clearSince('2026-08-11T00:00:00.000Z')).resolves.toBe(1);
  });
});
