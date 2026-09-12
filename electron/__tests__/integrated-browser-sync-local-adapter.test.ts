import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { BrowserBookmarkStore } from '../integrated-browser/bookmark-store';
import { applyBrowserSyncSession, createBrowserSyncLocalAdapter, projectBrowserSyncSession } from '../integrated-browser/sync-local-adapter';
import type { BrowserSessionSnapshot } from '../integrated-browser/platform-types';

let root: string;
beforeEach(async () => { root = await fs.mkdtemp(path.join(os.tmpdir(), 'pulse-sync-adapter-')); });
afterEach(async () => { await fs.rm(root, { recursive: true, force: true }); });
const guard = () => undefined;
function snapshot(): BrowserSessionSnapshot {
  return { version: 2, savedAt: '', cleanExit: false, activeTabId: 'one', primaryTabId: 'one', secondaryTabId: 'two', detachedTabIds: [], viewMode: 'split', tabLayout: 'horizontal', groups: [],
    tabs: [{ id: 'internal', url: 'about:blank', title: '', groupId: null, pinned: false, muted: false, position: 0 },
      { id: 'one', url: 'https://example.com/one?privado=1#local', title: 'Uno', groupId: null, pinned: false, muted: true, position: 1 },
      { id: 'two', url: 'https://example.com/two', title: 'Dos', groupId: null, pinned: false, muted: false, position: 2 }] };
}
describe('Adaptadores sync sobre stores consumibles', () => {
  it('proyecta posiciones contiguas sin transmitir páginas internas ni consultas privadas', () => {
    const state = snapshot(); const payload = projectBrowserSyncSession('tabs', state);
    expect(payload).toMatchObject([{ id: 'one', position: 0, url: 'https://example.com/one' }, { id: 'two', position: 1 }]);
    const applied = applyBrowserSyncSession('tabs', payload, state);
    expect(projectBrowserSyncSession('tabs', applied)).toEqual(payload);
    expect(applied.tabs.find((tab) => tab.id === 'one')).toMatchObject({ url: state.tabs[1].url, muted: true });
    expect(applied.tabs.some((tab) => tab.id === 'internal')).toBe(true);
  });
  it('rechaza colisiones internas, grupos ausentes y retirada de grupos utilizados', () => {
    const state = snapshot();
    expect(() => applyBrowserSyncSession('tabs', [{ id: 'internal', url: 'https://example.com/' }], state)).toThrow('colisiona');
    expect(() => applyBrowserSyncSession('tabs', [{ id: 'new', url: 'https://example.com/', groupId: 'missing' }], state)).toThrow('grupos');
    state.groups = [{ id: 'group', name: 'Trabajo', color: 'blue', collapsed: false }]; state.tabs[1].groupId = 'group';
    expect(() => applyBrowserSyncSession('groups', [], state)).toThrow('retiraría');
  });
  it('valida antes de publicar y conserva split y páginas locales al aplicar disposición', async () => {
    let state = snapshot();
    const apply = vi.fn(async (_before, next, check) => { check(); state = next; return true; });
    const adapter = createBrowserSyncLocalAdapter({ bookmarks: new BrowserBookmarkStore(path.join(root, 'bookmarks.json')), readSession: async () => state, compareAndApplySession: apply });
    await expect(adapter.prepare!('settings', { theme: 'dark' })).rejects.toThrow('tema');
    await expect(adapter.prepare!('tabs', [{ id: 'new', url: 'https://example.com/', groupId: 'missing' }])).rejects.toThrow('grupos');
    const prepared = await adapter.prepare!('settings', { tabLayout: 'vertical' });
    expect(await adapter.compareAndApply('settings', await adapter.read('settings'), prepared, guard)).toBe(true);
    expect(state).toMatchObject({ viewMode: 'split', primaryTabId: 'one', secondaryTabId: 'two', tabLayout: 'vertical' });
    expect(state.tabs).toEqual(snapshot().tabs);
    expect(await adapter.compareAndApply('settings', { tabLayout: 'horizontal' }, prepared, guard)).toBe(false);
  });
  it('los marcadores convergen tras normalizar y conservan parámetros locales sólo para su misma URL', async () => {
    const store = new BrowserBookmarkStore(path.join(root, 'bookmarks.json'));
    const saved = await store.save({ title: 'Uno', url: 'https://example.com/one?privado=1', tags: ['z', 'a'] });
    const adapter = createBrowserSyncLocalAdapter({ bookmarks: store, readSession: async () => snapshot(), compareAndApplySession: async () => true });
    const before = await adapter.read('bookmarks');
    const desired = await adapter.prepare!('bookmarks', [{ ...saved, title: ' Remoto\n nuevo ', position: 50 }]);
    expect(await adapter.compareAndApply('bookmarks', before, desired, guard)).toBe(true);
    expect(await adapter.read('bookmarks')).toEqual(desired);
    expect((await store.list())[0]).toMatchObject({ title: 'Remoto  nuevo', url: saved.url, tags: ['a', 'z'], position: 0 });
    await store.save({ ...saved, title: 'Edición tardía' });
    expect(await adapter.compareAndApply('bookmarks', desired, [], guard)).toBe(false);
    expect((await store.list())[0].title).toBe('Edición tardía');
  });
  it('no inventa fechas ni transmite marcadores ambiguos al retirar parámetros', async () => {
    const store = new BrowserBookmarkStore(path.join(root, 'bookmarks.json'));
    await expect(store.prepareSync([{ id: 'new', url: 'https://example.com/' }])).rejects.toThrow('fechas');
    await store.save({ title: 'Uno', url: 'https://example.com/?id=1' });
    await store.save({ title: 'Dos', url: 'https://example.com/?id=2' });
    await expect(store.prepareSync(await store.list())).rejects.toThrow('idéntica');
    expect(await store.list()).toHaveLength(2);
  });
});
