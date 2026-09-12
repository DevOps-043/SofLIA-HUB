import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { scopedPreferenceKey } from '../../services/user-scope';
import { integratedBrowserService, type BrowserBookmark, type IntegratedBrowserDataResponse } from '../../services/integrated-browser-service';

const FAVORITES_STORAGE_KEY = 'sofLia_integratedBrowserFavorites';
const FAVORITES_LIMIT = 24;

export interface BrowserFavorite {
  id: string;
  url: string;
  title: string;
  createdAt: string;
}

/**
 * Estado de marcadores compartido: la estrella acompana a la barra de
 * direcciones y la fila de marcadores solo se dibuja si hay alguno, para no
 * dejar un nivel vacio.
 */
export function useBrowserBookmarks(currentUrl: string, currentTitle: string) {
  const [favorites, setFavorites] = useState<BrowserFavorite[]>(readStoredFavorites);
  const [error, setError] = useState<string | null>(null);
  const revision = useRef(0);
  const scopeKey = scopedPreferenceKey(FAVORITES_STORAGE_KEY);
  const safeCurrentUrl = useMemo(() => sanitizeFavoriteUrl(currentUrl), [currentUrl]);
  const currentFavorite = safeCurrentUrl ? favorites.find((favorite) => favorite.url === safeCurrentUrl) : undefined;

  const refresh = useCallback(async () => {
    const requestRevision = ++revision.current;
    try {
      const response = await integratedBrowserService.listBookmarks();
      if (scopeKey !== scopedPreferenceKey(FAVORITES_STORAGE_KEY) || requestRevision !== revision.current) return;
      if (!response.success) throw new Error(response.error || 'No se pudieron cargar los marcadores.');
      setFavorites((response.bookmarks ?? []).map(toFavorite));
      setError(null);
    } catch (failure) {
      if (scopeKey === scopedPreferenceKey(FAVORITES_STORAGE_KEY)) setError(failure instanceof Error ? failure.message : 'No se pudieron cargar los marcadores.');
    }
  }, [scopeKey]);

  useEffect(() => {
    let canceled = false;
    void (async () => {
      const legacy = readStoredFavorites();
      if (legacy.length) {
        const migration = await integratedBrowserService.migrateLegacyBookmarks(legacy).catch(() => ({ success: false } as IntegratedBrowserDataResponse));
        if (migration.success) {
          try { localStorage.removeItem(scopeKey); } catch { /* migración ya persistida */ }
        }
      }
      if (!canceled) await refresh();
    })();
    return () => { canceled = true; };
  }, [scopeKey, refresh]);

  const remove = async (id: string) => {
    revision.current += 1;
    try {
      const response = await integratedBrowserService.removeBookmark(id);
      if (scopeKey !== scopedPreferenceKey(FAVORITES_STORAGE_KEY)) return;
      if (!response.success) throw new Error(response.error || 'No se pudo quitar el marcador.');
      setFavorites((current) => current.filter((favorite) => favorite.id !== id));
      setError(null);
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'No se pudo quitar el marcador.'); }
  };

  return {
    favorites: favorites.slice(0, FAVORITES_LIMIT),
    error,
    refresh,
    canBookmark: Boolean(safeCurrentUrl),
    isBookmarked: Boolean(currentFavorite),
    remove: (id: string) => { void remove(id); },
    toggleCurrent: () => { void (async () => {
      if (!safeCurrentUrl) return;
      revision.current += 1;
      if (currentFavorite) {
        await remove(currentFavorite.id);
        return;
      }
      const input = {
        url: safeCurrentUrl,
        title: sanitizeFavoriteTitle(currentTitle, safeCurrentUrl),
      };
      try {
        const response = await integratedBrowserService.saveBookmark(input);
        if (scopeKey !== scopedPreferenceKey(FAVORITES_STORAGE_KEY)) return;
        const bookmark = response.bookmark;
        if (!response.success || !bookmark) throw new Error(response.error || 'No se pudo guardar el marcador.');
        setFavorites((current) => [toFavorite(bookmark), ...current.filter((favorite) => favorite.url !== bookmark.url)]);
        setError(null);
      } catch (failure) { setError(failure instanceof Error ? failure.message : 'No se pudo guardar el marcador.'); }
    })(); },
  };
}

function toFavorite(bookmark: BrowserBookmark): BrowserFavorite {
  return { id: bookmark.id, url: bookmark.url, title: bookmark.title, createdAt: bookmark.createdAt };
}

export type BrowserBookmarksState = ReturnType<typeof useBrowserBookmarks>;

function readStoredFavorites(): BrowserFavorite[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(scopedPreferenceKey(FAVORITES_STORAGE_KEY)) ?? '[]') as unknown;
    if (!Array.isArray(parsed)) return [];
    const unique = new Set<string>();
    const favorites: BrowserFavorite[] = [];
    for (const value of parsed) {
      if (!value || typeof value !== 'object') continue;
      const candidate = value as Partial<BrowserFavorite>;
      const url = sanitizeFavoriteUrl(candidate.url);
      if (!url || unique.has(url)) continue;
      unique.add(url);
      favorites.push({
        id: typeof candidate.id === 'string' && candidate.id ? candidate.id.slice(0, 100) : createFavoriteId(),
        url,
        title: sanitizeFavoriteTitle(candidate.title, url),
        createdAt: typeof candidate.createdAt === 'string' && !Number.isNaN(Date.parse(candidate.createdAt)) ? candidate.createdAt : new Date().toISOString(),
      });
      if (favorites.length === FAVORITES_LIMIT) break;
    }
    return favorites;
  } catch {
    return [];
  }
}

function sanitizeFavoriteUrl(raw: unknown): string | null {
  if (typeof raw !== 'string' || raw.length > 2_048) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    url.username = '';
    url.password = '';
    return url.toString();
  } catch {
    return null;
  }
}

function sanitizeFavoriteTitle(raw: unknown, url: string): string {
  const title = typeof raw === 'string' ? raw.replace(/[\r\n\t]+/g, ' ').trim().slice(0, 120) : '';
  if (title) return title;
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return 'Favorito'; }
}

function createFavoriteId(): string {
  return typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `favorito-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
