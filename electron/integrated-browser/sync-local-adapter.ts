import type { BrowserSyncCategory, BrowserSessionSnapshot, BrowserTabGroupColor } from './platform-types';
import { BROWSER_TAB_GROUP_COLORS } from './platform-types';
import { normalizeBrowserSyncInput, type BrowserSyncPayload, type BrowserSyncRecord } from './sync-crypto';
import type { BrowserBookmarkStore } from './bookmark-store';

export interface BrowserSyncLocalAdapter {
  read(category: BrowserSyncCategory): Promise<BrowserSyncPayload>;
  prepare?(category: BrowserSyncCategory, next: BrowserSyncPayload): Promise<BrowserSyncPayload>;
  compareAndApply(category: BrowserSyncCategory, expected: BrowserSyncPayload, next: BrowserSyncPayload, guard: () => void): Promise<boolean>;
}
function canonical(raw: unknown): string {
  if (Array.isArray(raw)) return `[${raw.map(canonical).join(',')}]`;
  if (raw && typeof raw === 'object') return `{${Object.keys(raw).sort().map((key) => `${JSON.stringify(key)}:${canonical((raw as Record<string, unknown>)[key])}`).join(',')}}`;
  return JSON.stringify(raw);
}
export function sameSyncPayload(a: unknown, b: unknown): boolean { return canonical(a) === canonical(b); }
export function projectBrowserSyncSession(category: BrowserSyncCategory, session: BrowserSessionSnapshot): BrowserSyncPayload {
  const payload = category === 'tabs' ? session.tabs.filter((tab) => /^https?:/.test(tab.url)).map(({ id, url, title, groupId, pinned }, position) => ({ id, url, title, groupId, pinned, position }))
    : category === 'groups' ? session.groups.map((group, position) => ({ ...group, position })) : { tabLayout: session.tabLayout };
  return normalizeBrowserSyncInput({ category, payload }).payload;
}
export function applyBrowserSyncSession(category: BrowserSyncCategory, raw: BrowserSyncPayload, previous: BrowserSessionSnapshot): BrowserSessionSnapshot {
  const normalized = normalizeBrowserSyncInput({ category, payload: raw }).payload;
  const payload = Array.isArray(normalized) ? [...normalized].sort((a, b) => Number(a.position ?? 0) - Number(b.position ?? 0) || String(a.id).localeCompare(String(b.id), 'en')) : normalized;
  const next = structuredClone(previous);
  if (category === 'settings') {
    const settings = payload as BrowserSyncRecord;
    if ('theme' in settings) throw new Error('Este cliente no sincroniza el tema todavía.');
    if (settings.tabLayout) next.tabLayout = settings.tabLayout as 'horizontal' | 'vertical';
  } else if (category === 'groups') {
    next.groups = (payload as BrowserSyncRecord[]).map((row) => {
      if (typeof row.name !== 'string' || !BROWSER_TAB_GROUP_COLORS.includes(row.color as BrowserTabGroupColor)) throw new Error('El grupo remoto no es compatible.');
      return { id: String(row.id), name: row.name, color: row.color as BrowserTabGroupColor, collapsed: row.collapsed === true };
    });
    if (next.tabs.some((tab) => tab.groupId && !next.groups.some((group) => group.id === tab.groupId))) throw new Error('La actualización retiraría un grupo con pestañas. Revisa los grupos locales antes de continuar.');
  } else if (category === 'tabs') {
    const rows = payload as BrowserSyncRecord[];
    if (rows.length > 500) throw new Error('La sesión remota supera el límite de pestañas.');
    next.tabs = rows.map((row, position) => {
      const local = previous.tabs.find((tab) => tab.id === row.id);
      if (local && !/^https?:/.test(local.url)) throw new Error('Una pestaña remota colisiona con una página interna local.');
      const groupId = typeof row.groupId === 'string' ? row.groupId : null;
      if (groupId && !next.groups.some((group) => group.id === groupId)) throw new Error('Sincroniza primero los grupos referenciados por las pestañas.');
      const localUrl = local ? new URL(local.url) : null;
      if (localUrl) { localUrl.search = ''; localUrl.hash = ''; }
      const url = localUrl?.href === row.url ? local!.url : String(row.url);
      return { id: String(row.id), url, title: typeof row.title === 'string' ? row.title : '', groupId, pinned: row.pinned === true, muted: local?.muted ?? false, position };
    });
    // Las páginas internas no son transmitibles ni se retiran al importar HTTP(S).
    for (const tab of previous.tabs.filter((tab) => !/^https?:/.test(tab.url))) next.tabs.push({ ...tab, position: next.tabs.length });
    if (next.tabs.length > 500) throw new Error('La combinación supera el límite local de pestañas.');
    next.detachedTabIds = previous.detachedTabIds.filter((id) => next.tabs.some((tab) => tab.id === id));
  }
  return next;
}
export function createBrowserSyncLocalAdapter(input: {
  bookmarks: BrowserBookmarkStore;
  readSession: () => Promise<BrowserSessionSnapshot>;
  compareAndApplySession: (expected: BrowserSessionSnapshot, next: BrowserSessionSnapshot, guard: () => void) => Promise<boolean>;
}): BrowserSyncLocalAdapter {
  return {
    async read(category) { return category === 'bookmarks' ? input.bookmarks.prepareSync(await input.bookmarks.list()) : projectBrowserSyncSession(category, await input.readSession()); },
    async prepare(category, next) {
      if (category === 'bookmarks') return input.bookmarks.prepareSync(next);
      return projectBrowserSyncSession(category, applyBrowserSyncSession(category, next, await input.readSession()));
    },
    async compareAndApply(category, expected, next, guard) {
      guard();
      if (category === 'bookmarks') return input.bookmarks.applySync(expected, next, guard);
      const before = await input.readSession(); guard();
      if (!sameSyncPayload(projectBrowserSyncSession(category, before), expected)) return false;
      return input.compareAndApplySession(before, applyBrowserSyncSession(category, next, before), guard);
    },
  };
}
