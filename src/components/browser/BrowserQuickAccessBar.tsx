import { useMemo, useState } from 'react';
import type { BrowserExtensionMetadata } from '../../services/integrated-browser-service';

const FAVORITES_STORAGE_KEY = 'sofLia_integratedBrowserFavorites';
const FAVORITES_LIMIT = 24;

interface BrowserFavorite {
  id: string;
  url: string;
  title: string;
  createdAt: string;
}

export function BrowserQuickAccessBar(props: {
  currentUrl: string;
  currentTitle: string;
  extensions: BrowserExtensionMetadata[];
  onNavigate: (url: string) => void;
  onOpenExtensions: () => void;
}) {
  const [favorites, setFavorites] = useState<BrowserFavorite[]>(readStoredFavorites);
  const safeCurrentUrl = useMemo(() => sanitizeFavoriteUrl(props.currentUrl), [props.currentUrl]);
  const currentFavorite = safeCurrentUrl ? favorites.find((favorite) => favorite.url === safeCurrentUrl) : undefined;

  const updateFavorites = (next: BrowserFavorite[]) => {
    const bounded = next.slice(0, FAVORITES_LIMIT);
    setFavorites(bounded);
    try { localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(bounded)); } catch { /* preferencia no persistible */ }
  };

  const toggleCurrentFavorite = () => {
    if (!safeCurrentUrl) return;
    if (currentFavorite) {
      updateFavorites(favorites.filter((favorite) => favorite.id !== currentFavorite.id));
      return;
    }
    updateFavorites([{
      id: createFavoriteId(),
      url: safeCurrentUrl,
      title: sanitizeFavoriteTitle(props.currentTitle, safeCurrentUrl),
      createdAt: new Date().toISOString(),
    }, ...favorites.filter((favorite) => favorite.url !== safeCurrentUrl)]);
  };

  return (
    <div className="flex min-w-0 flex-1 items-center gap-1.5" aria-label="Favoritos y extensiones">
      <button
        type="button"
        disabled={!safeCurrentUrl}
        aria-label={currentFavorite ? 'Quitar página actual de favoritos' : 'Agregar página actual a favoritos'}
        title={currentFavorite ? 'Quitar de favoritos' : 'Agregar a favoritos'}
        aria-pressed={Boolean(currentFavorite)}
        onClick={toggleCurrentFavorite}
        className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-30 ${currentFavorite ? 'bg-amber-400/15 text-amber-500' : 'text-secondary hover:bg-amber-400/10 hover:text-amber-500'}`}
      >
        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill={currentFavorite ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 3.7l2.5 5.1 5.6.8-4.1 4 .9 5.6-4.9-2.6-4.9 2.6.9-5.6-4.1-4 5.6-.8z" />
        </svg>
      </button>
      <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto [scrollbar-width:none]" role="toolbar" aria-label="Accesos rápidos del navegador">
        {favorites.map((favorite) => (
          <div key={favorite.id} className="group flex h-7 shrink-0 items-center rounded-lg border border-transparent bg-gray-100/75 text-gray-600 transition hover:border-gray-200 dark:bg-white/[0.045] dark:text-white/65 dark:hover:border-white/[0.09]">
            <button
              type="button"
              title={`${favorite.title} · ${favorite.url}`}
              onClick={() => props.onNavigate(favorite.url)}
              className="flex h-full max-w-40 items-center gap-1.5 rounded-l-lg px-2 text-[11px] font-medium outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent"
            >
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />
              <span className="truncate">{favorite.title}</span>
            </button>
            <button
              type="button"
              aria-label={`Quitar ${favorite.title} de favoritos`}
              title="Quitar favorito"
              onClick={() => updateFavorites(favorites.filter((item) => item.id !== favorite.id))}
              className="grid h-6 w-6 place-items-center rounded-md opacity-45 transition hover:bg-danger/10 hover:text-danger hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
            </button>
          </div>
        ))}
        {favorites.length > 0 && props.extensions.length > 0 && <span className="mx-0.5 h-4 w-px shrink-0 bg-gray-200 dark:bg-white/10" aria-hidden="true" />}
        {props.extensions.slice(0, 12).map((extension) => (
          <button
            key={extension.installId}
            type="button"
            aria-label={`Abrir extensión ${extension.name}`}
            title={`${extension.name} · ${extensionStatusLabel(extension)}`}
            onClick={props.onOpenExtensions}
            className="flex h-7 max-w-36 shrink-0 items-center gap-1.5 rounded-lg px-2 text-[11px] font-medium text-secondary transition hover:bg-accent/[0.08] hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M8 3h5v5a2 2 0 104 0V3h4v7h-5a2 2 0 100 4h5v7h-7v-5a2 2 0 10-4 0v5H3v-7h5a2 2 0 100-4H3V3h5z" /></svg>
            <span className="truncate">{extension.name}</span>
            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${extension.status === 'loaded' ? 'bg-emerald-500' : extension.status === 'error' ? 'bg-danger' : 'bg-gray-400'}`} aria-hidden="true" />
          </button>
        ))}
        {props.extensions.length > 12 && (
          <button type="button" onClick={props.onOpenExtensions} className="h-7 shrink-0 rounded-lg px-2 text-[11px] font-semibold text-accent transition hover:bg-accent/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
            +{props.extensions.length - 12}
            <span className="sr-only"> extensiones más</span>
          </button>
        )}
      </div>
    </div>
  );
}

function readStoredFavorites(): BrowserFavorite[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(FAVORITES_STORAGE_KEY) ?? '[]') as unknown;
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

function extensionStatusLabel(extension: BrowserExtensionMetadata): string {
  if (extension.status === 'loaded') return 'Activa';
  if (extension.status === 'error') return 'Requiere atención';
  return 'Deshabilitada';
}
