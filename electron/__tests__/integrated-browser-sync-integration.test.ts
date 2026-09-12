import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { safeStorage } from 'electron';
import { BrowserSyncClient } from '../integrated-browser/sync-client';
import { BrowserSyncCrypto, type BrowserSyncEnvelope } from '../integrated-browser/sync-crypto';
import { BrowserSyncCheckpointStore } from '../integrated-browser/sync-checkpoint-store';
import { BrowserSyncConflictStore } from '../integrated-browser/sync-conflict-store';
import { BrowserBookmarkStore } from '../integrated-browser/bookmark-store';
import { createBrowserSyncLocalAdapter } from '../integrated-browser/sync-local-adapter';
import type { BrowserSessionSnapshot, BrowserSyncCategory } from '../integrated-browser/platform-types';
import http from 'node:http';
import { BrowserSyncRemote } from '../integrated-browser/sync-remote';
import { BrowserSyncController, type BrowserSyncControlContext } from '../integrated-browser/sync-controller';

let root: string;
beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'pulse-sync-integration-'));
  vi.mocked(safeStorage.isEncryptionAvailable).mockReturnValue(true);
  vi.mocked(safeStorage.encryptString).mockImplementation((text) => Buffer.from(Buffer.from(text).map((byte) => byte ^ 93)));
  vi.mocked(safeStorage.decryptString).mockImplementation((bytes) => Buffer.from(Buffer.from(bytes).map((byte) => byte ^ 93)).toString('utf8'));
});
afterEach(async () => { vi.restoreAllMocks(); await fs.rm(root, { recursive: true, force: true }); });
describe('Sync entre dos clientes con stores reales y transporte simulado', () => {
  it('recorre controlador, transporte HTTP real, recuperación y revisión inicial entre perfiles aislados', async () => {
    const binding = { ownerId: '11111111-1111-4111-8111-111111111111', sessionId: '22222222-2222-4222-8222-222222222222', origin: 'https://fixture.supabase.co' };
    const cloud = new Map<string, { revision: number; envelope: BrowserSyncEnvelope }>();
    const requests: Array<{ path: string; body: string }> = [];
    let active = true;
    const server = http.createServer((req, res) => {
      let body = '';
      req.on('data', (chunk) => { body += chunk; });
      req.on('end', () => {
        const url = new URL(req.url!, 'http://localhost');
        requests.push({ path: url.pathname, body });
        res.setHeader('Content-Type', 'application/json');
        if (req.headers.authorization !== 'Bearer token-ficticio') { res.statusCode = 403; res.end('{}'); return; }
        if (url.pathname === '/auth/v1/user') { res.end(JSON.stringify({ id: binding.ownerId, is_anonymous: false })); return; }
        if (url.pathname.endsWith('browser_sync_session_active')) { res.end(JSON.stringify(active)); return; }
        if (!active) { res.statusCode = 403; res.end('{}'); return; }
        if (url.pathname.endsWith('browser_sync_envelopes')) {
          const category = url.searchParams.get('category')?.replace('eq.', '') ?? '';
          res.end(JSON.stringify(cloud.has(category) ? [cloud.get(category)] : [])); return;
        }
        if (url.pathname.endsWith('browser_sync_put')) {
          const input = JSON.parse(body);
          const revision = cloud.get(input.p_category)?.revision ?? 0;
          if (revision !== input.p_expected_revision) { res.end(JSON.stringify({ status: 'conflict', revision })); return; }
          cloud.set(input.p_category, { revision: revision + 1, envelope: input.p_envelope });
          res.end(JSON.stringify({ status: 'written', revision: revision + 1 })); return;
        }
        res.statusCode = 404; res.end('{}');
      });
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address() as { port: number };
    // Sólo la prueba remapea el destino a loopback; el cliente de producto sigue exigiendo HTTPS/Lia.
    const fetcher: typeof fetch = (input, init) => fetch(`http://127.0.0.1:${address.port}${new URL(String(input)).pathname}${new URL(String(input)).search}`, init);
    const connect = async (signal: AbortSignal, guard: () => void) => {
      const remote = new BrowserSyncRemote({ ...binding, apiKey: 'publica-ficticia', accessToken: 'token-ficticio' }, guard, fetcher);
      await remote.verify(signal);
      return { binding, remote, dispose: vi.fn() };
    };
    const device = (name: string) => {
      const profileRoot = path.join(root, name);
      const bookmarks = new BrowserBookmarkStore(path.join(profileRoot, 'bookmarks.json'));
      const local = createBrowserSyncLocalAdapter({ bookmarks,
        readSession: async () => { throw new Error('La categoría no debe leerse.'); },
        compareAndApplySession: async () => { throw new Error('La categoría no debe escribirse.'); } });
      const context: BrowserSyncControlContext = { enabled: true, authenticated: true, profileRoot, local,
        guard: () => undefined, confirm: vi.fn(async () => true), recoveryPath: async () => path.join(root, 'recovery.txt') };
      return { context, bookmarks, controller: new BrowserSyncController(connect) };
    };
    try {
      const one = device('one'), two = device('two');
      await one.bookmarks.save({ title: 'Título confidencial ficticio', url: 'https://example.com/uno?token=privado', tags: [] });
      await one.controller.keys('export', one.context);
      await one.controller.configure(['bookmarks'], one.context);
      expect((await one.controller.synchronize(one.context)).state).toBe('idle');
      await two.controller.keys('import', two.context);
      await two.controller.configure(['bookmarks'], two.context);
      expect((await two.controller.synchronize(two.context)).initialCategories).toEqual(['bookmarks']);
      expect(await two.bookmarks.list()).toEqual([]);
      expect((await two.controller.synchronize(two.context, { category: 'bookmarks', choice: 'remote' })).state).toBe('idle');
      expect((await two.bookmarks.list())[0]).toMatchObject({ title: 'Título confidencial ficticio', url: 'https://example.com/uno' });
      expect(JSON.stringify(requests)).not.toContain('confidencial'); expect(JSON.stringify(requests)).not.toContain('privado');
      const code = await fs.readFile(path.join(root, 'recovery.txt'), 'utf8');
      expect(JSON.stringify(requests)).not.toContain(code);
      const writes = requests.filter((request) => request.path.endsWith('browser_sync_put')).length;
      await new BrowserSyncController(connect).synchronize(two.context);
      expect(requests.filter((request) => request.path.endsWith('browser_sync_put'))).toHaveLength(writes);
      active = false;
      await expect(two.controller.synchronize(two.context)).rejects.toThrow('dispositivo');
      expect(requests.filter((request) => request.path.endsWith('browser_sync_put'))).toHaveLength(writes);
      await two.controller.configure([], two.context);
      await expect(two.controller.synchronize(two.context)).rejects.toThrow('categoría');
      expect((await two.controller.status(two.context)).keyAvailable).toBe(true);
    } finally { server.closeAllConnections(); await new Promise<void>((resolve) => server.close(() => resolve())); }
  });

  it('recupera clave, aplica las cuatro categorías y combina ediciones independientes sin bucles de escritura', async () => {
    const binding = { ownerId: '11111111-1111-4111-8111-111111111111', sessionId: '22222222-2222-4222-8222-222222222222', origin: 'https://fixture.supabase.co' };
    const categories: BrowserSyncCategory[] = ['bookmarks', 'groups', 'tabs', 'settings'];
    const cloud = new Map<BrowserSyncCategory, { revision: number; envelope: BrowserSyncEnvelope }>();
    const receipts = new Map<string, number>();
    const remote = { active: vi.fn(async () => true), read: vi.fn(async (category: BrowserSyncCategory) => cloud.get(category) ?? null),
      put: vi.fn(async (envelope: BrowserSyncEnvelope, revision: number, key: string) => {
        if (receipts.has(key)) return { status: 'replayed' as const, revision: receipts.get(key)! };
        const current = cloud.get(envelope.category)?.revision ?? 0;
        if (current !== revision) return { status: 'conflict' as const, revision: current };
        cloud.set(envelope.category, { revision: revision + 1, envelope }); receipts.set(key, revision + 1);
        return { status: 'written' as const, revision: revision + 1 };
      }) };
    function device(name: string) {
      const destination = (file: string) => path.join(root, name, file);
      const crypto = new BrowserSyncCrypto(destination('key.json'));
      const bookmarks = new BrowserBookmarkStore(destination('bookmarks.json'));
      let snapshot: BrowserSessionSnapshot = { version: 2, savedAt: '', cleanExit: false, activeTabId: null, primaryTabId: null, secondaryTabId: null, detachedTabIds: [], viewMode: 'single', tabLayout: 'horizontal', tabs: [], groups: [] };
      const local = createBrowserSyncLocalAdapter({ bookmarks, readSession: async () => snapshot, compareAndApplySession: async (before, next, guard) => {
        guard(); if (JSON.stringify(before) !== JSON.stringify(snapshot)) return false; snapshot = next; return true;
      } });
      const client = new BrowserSyncClient({ crypto, local, checkpoints: new BrowserSyncCheckpointStore(destination('checkpoint.json')), conflicts: new BrowserSyncConflictStore(destination('conflicts.json')) });
      return { crypto, bookmarks, local, setSession: (next: BrowserSessionSnapshot) => { snapshot = next; }, getSession: () => snapshot,
        run: (extra: Partial<Parameters<BrowserSyncClient['synchronize']>[0]> = {}) => client.synchronize({ categories, binding, signal: new AbortController().signal, guard: () => undefined, remote, ...extra }) };
    }
    const one = device('one'), two = device('two');
    const { recoveryCode } = await one.crypto.initialize(); await two.crypto.restore(recoveryCode!);
    await one.bookmarks.save({ title: 'Base', url: 'https://example.com/page?local=1', tags: [] });
    one.setSession({ ...one.getSession(), tabLayout: 'vertical', groups: [{ id: 'work', name: 'Trabajo', color: 'blue', collapsed: false }],
      tabs: [{ id: 'tab', url: 'https://example.com/page?sesion=privada', title: 'Página', groupId: 'work', pinned: true, muted: false, position: 0 }] });
    expect((await one.run()).state).toBe('idle');
    expect((await two.run()).initialCategories).toEqual(categories);
    expect((await two.run({ initialResolution: { bookmarks: 'remote', groups: 'remote', tabs: 'remote', settings: 'remote' } })).state).toBe('idle');
    expect(two.getSession()).toMatchObject({ tabLayout: 'vertical', groups: [{ id: 'work' }], tabs: [{ id: 'tab', groupId: 'work', url: 'https://example.com/page' }] });
    expect((await two.bookmarks.list())[0].url).toBe('https://example.com/page');
    await one.run(); const settled = remote.put.mock.calls.length;
    await one.run(); await two.run(); expect(remote.put).toHaveBeenCalledTimes(settled);
    await one.bookmarks.save({ ...(await one.bookmarks.list())[0], title: 'Título editado' });
    await two.bookmarks.save({ ...(await two.bookmarks.list())[0], tags: ['nuevo'] });
    await one.run();
    const merged = await two.run();
    // updatedAt puede necesitar elección si ambos relojes guardaron instantes distintos.
    if (merged.state === 'conflict') await two.run({ conflictResolution: Object.fromEntries(merged.conflicts.map((review) => [review.reviewId, 'local' as const])) });
    expect((await two.bookmarks.list())[0]).toMatchObject({ title: 'Título editado', tags: ['nuevo'] });
    await one.run(); expect((await one.bookmarks.list())[0]).toMatchObject({ title: 'Título editado', tags: ['nuevo'], url: 'https://example.com/page?local=1' });
    const writes = remote.put.mock.calls.length; await one.run(); await two.run(); expect(remote.put).toHaveBeenCalledTimes(writes);
    expect(JSON.stringify([...cloud.values()])).not.toContain('Título editado');
    // Un principal perdido no equivale a que el usuario haya borrado todos sus
    // marcadores: detener sync antes de publicar una colección vacía.
    const bookmarkFile = path.join(root, 'two', 'bookmarks.json');
    await fs.access(`${bookmarkFile}.bak`); await fs.unlink(bookmarkFile);
    await expect(two.run()).rejects.toThrow('marcadores');
    expect(remote.put).toHaveBeenCalledTimes(writes);
    expect((await two.bookmarks.prepareRecovery()).count).toBeGreaterThan(0);
  });
});
