import { useMemo, useState } from 'react';
import { scopedPreferenceKey } from '../../services/user-scope';

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
  const safeCurrentUrl = useMemo(() => sanitizeFavoriteUrl(currentUrl), [currentUrl]);
  const currentFavorite = safeCurrentUrl ? favorites.find((favorite) => favorite.url === safeCurrentUrl) : undefined;

  const updateFavorites = (next: BrowserFavorite[]) => {
    const bounded = next.slice(0, FAVORITES_LIMIT);
    setFavorites(bounded);
    try { localStorage.setItem(scopedPreferenceKey(FAVORITES_STORAGE_KEY), JSON.stringify(bounded)); } catch { /* preferencia no persistible */ }
  };

  return {
    favorites,
    canBookmark: Boolean(safeCurrentUrl),
    isBookmarked: Boolean(currentFavorite),
    remove: (id: string) => updateFavorites(favorites.filter((favorite) => favorite.id !== id)),
    toggleCurrent: () => {
      if (!safeCurrentUrl) return;
      if (currentFavorite) {
        updateFavorites(favorites.filter((favorite) => favorite.id !== currentFavorite.id));
        return;
      }
      updateFavorites([{
        id: createFavoriteId(),
        url: safeCurrentUrl,
        title: sanitizeFavoriteTitle(currentTitle, safeCurrentUrl),
        createdAt: new Date().toISOString(),
      }, ...favorites.filter((favorite) => favorite.url !== safeCurrentUrl)]);
    },
  };
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
