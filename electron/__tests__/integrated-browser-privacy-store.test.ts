import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BrowserPrivacyStore } from '../integrated-browser/privacy-store';

const roots: string[] = [];
afterEach(() => Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true }))));
async function store() { const root = await fs.mkdtemp(path.join(os.tmpdir(), 'soflia-privacy-')); roots.push(root); return new BrowserPrivacyStore(path.join(root, 'privacy.json')); }

describe('BrowserPrivacyStore', () => {
  it('la barrera espera una mutación que todavía está leyendo y permite invalidar el caché', async () => {
    const privacy = await store();
    let release!: () => void;
    const held = new Promise<void>((resolve) => { release = resolve; });
    const read = vi.spyOn(fs, 'lstat').mockImplementationOnce(async () => {
      await held;
      const error = new Error('ausente') as NodeJS.ErrnoException;
      error.code = 'ENOENT';
      throw error;
    });
    const writing = privacy.set({ origin: 'https://example.com', level: 'off', exceptionCategories: [] });
    let flushed = false;
    const flushing = privacy.flush().then(() => { flushed = true; });
    try {
      await new Promise((resolve) => setImmediate(resolve));
      expect(flushed).toBe(false);
      release();
      await Promise.all([writing, flushing]);
      expect(privacy.peek('https://example.com').level).toBe('off');
      privacy.invalidateCache();
      expect(privacy.peek('https://example.com').level).toBe('balanced');
    } finally {
      release();
      await Promise.allSettled([writing, flushing]);
      read.mockRestore();
    }
  });

  it('aísla escrituras concurrentes y cachés al cambiar de perfil', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'soflia-privacy-scope-'));
    roots.push(root);
    let destination = path.join(root, 'a.json');
    const privacy = new BrowserPrivacyStore(() => destination);
    const a = privacy.set({ origin: 'https://example.com', level: 'off', exceptionCategories: [] });
    destination = path.join(root, 'b.json');
    expect(privacy.peek('https://example.com').level).toBe('balanced');
    const b = privacy.set({ origin: 'https://example.com', level: 'strict', exceptionCategories: [] });
    await Promise.all([a, b]);
    expect((await privacy.get('https://example.com')).level).toBe('strict');
    destination = path.join(root, 'a.json');
    expect((await privacy.get('https://example.com')).level).toBe('off');
    expect((await new BrowserPrivacyStore(path.join(root, 'b.json')).get('https://example.com')).level).toBe('strict');
  });

  it('mantiene nivel, excepciones y contadores por origen', async () => {
    const privacy = await store();
    await privacy.set({ origin: 'https://example.com/page', level: 'strict', exceptionCategories: ['advertising'] });
    await privacy.increment('https://example.com/other', 'tracker');
    expect(await privacy.get('https://example.com')).toEqual({ origin: 'https://example.com', level: 'strict', exceptionCategories: ['advertising'], blocked: { tracker: 1 }, degraded: false });
  });

  it('no permite exceptuar malware ni usar esquemas locales', async () => {
    const privacy = await store();
    await expect(privacy.set({ origin: 'https://example.com', level: 'off', exceptionCategories: ['malware'] })).rejects.toThrow();
    await expect(privacy.set({ origin: 'file:///local', level: 'balanced', exceptionCategories: [] })).rejects.toThrow();
  });
});
