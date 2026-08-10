import { useMemo, useState } from 'react';
import type { BrowserBookmarksState } from './use-browser-bookmarks';
import type { BrowserExtensionMetadata } from '../../services/integrated-browser-service';

/**
 * Iconos de extensiones, junto a la barra de direcciones como en cualquier
 * navegador. Los marcadores viven en su propia fila: mezclarlos aqui competia
 * por el ancho de la direccion y se leia mal.
 */
export function BrowserExtensionsBar(props: {
  extensions: BrowserExtensionMetadata[];
  onOpenExtensions: () => void;
}) {
  if (props.extensions.length === 0) return null;
  return (
    <div className="flex shrink-0 items-center gap-0.5" role="toolbar" aria-label="Extensiones del navegador">
      {props.extensions.slice(0, 8).map((extension) => (
        <button
          key={extension.installId}
          type="button"
          aria-label={`Abrir extensión ${extension.name}`}
          title={`${extension.name} · ${extensionStatusLabel(extension)}`}
          onClick={props.onOpenExtensions}
          className="relative grid h-8 w-8 place-items-center rounded-[9px] text-secondary transition hover:bg-accent/[0.08] hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M8 3h5v5a2 2 0 104 0V3h4v7h-5a2 2 0 100 4h5v7h-7v-5a2 2 0 10-4 0v5H3v-7h5a2 2 0 100-4H3V3h5z" /></svg>
          <span className={`absolute bottom-1 right-1 h-1.5 w-1.5 rounded-full ${extension.status === 'loaded' ? 'bg-emerald-500' : extension.status === 'error' ? 'bg-danger' : 'bg-gray-400'}`} aria-hidden="true" />
        </button>
      ))}
      {props.extensions.length > 8 && (
        <button type="button" onClick={props.onOpenExtensions} className="h-8 shrink-0 rounded-[9px] px-1.5 text-[11px] font-semibold text-accent transition hover:bg-accent/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
          +{props.extensions.length - 8}
          <span className="sr-only"> extensiones más</span>
        </button>
      )}
    </div>
  );
}

/** Estrella para marcar la pagina actual, junto a la barra de direcciones. */
export function BrowserBookmarkToggle({ bookmarks }: { bookmarks: BrowserBookmarksState }) {
  return (
    <button
      type="button"
      disabled={!bookmarks.canBookmark}
      aria-label={bookmarks.isBookmarked ? 'Quitar página actual de marcadores' : 'Agregar página actual a marcadores'}
      title={bookmarks.isBookmarked ? 'Quitar de marcadores' : 'Agregar a marcadores'}
      aria-pressed={bookmarks.isBookmarked}
      onClick={bookmarks.toggleCurrent}
      className={`group grid h-8.5 w-8.5 shrink-0 place-items-center rounded-lg transition-all duration-200 hover:scale-105 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-30 ${
        bookmarks.isBookmarked
          ? 'bg-amber-400/20 text-amber-500 shadow-xs shadow-amber-500/20'
          : 'text-gray-500 hover:bg-amber-400/10 hover:text-amber-500 dark:text-gray-400 dark:hover:text-amber-400'
      }`}
    >
      <svg
        className={`h-4 w-4 transition-transform duration-200 group-hover:scale-110 ${bookmarks.isBookmarked ? 'fill-amber-400' : 'fill-none'}`}
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
      </svg>
    </button>
  );
}

/** Fila de marcadores, bajo la barra de direcciones. */
export function BrowserBookmarksBar(props: {
  bookmarks: BrowserBookmarksState;
  onNavigate: (url: string) => void;
}) {
  const { favorites } = props.bookmarks;
  if (favorites.length === 0) return null;

  return (
    <div className="flex min-w-0 items-center gap-1.5" aria-label="Marcadores">
      <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto [scrollbar-width:none]" role="toolbar" aria-label="Marcadores del navegador">
        {favorites.map((favorite) => (
          <div key={favorite.id} className="group flex h-7 shrink-0 items-center rounded-lg border border-gray-200/70 bg-white/90 text-gray-700 shadow-xs transition-all duration-200 hover:scale-105 hover:border-accent/40 hover:text-accent hover:shadow-xs dark:border-white/[0.08] dark:bg-[#161b22] dark:text-white/80">
            <button
              type="button"
              title={`${favorite.title} · ${favorite.url}`}
              onClick={() => props.onNavigate(favorite.url)}
              className="flex h-full max-w-44 items-center gap-1.5 rounded-l-lg px-2.5 text-[11px] font-medium outline-none focus-visible:ring-1 focus-visible:ring-accent"
            >
              <BookmarkFavicon url={favorite.url} />
              <span className="truncate">{favorite.title}</span>
            </button>
            <button
              type="button"
              aria-label={`Quitar ${favorite.title} de marcadores`}
              title="Quitar favorito"
              onClick={() => props.bookmarks.remove(favorite.id)}
              className="mr-1 grid h-5 w-5 place-items-center rounded-md opacity-40 transition-all duration-150 hover:bg-danger/10 hover:text-danger hover:opacity-100 focus-visible:opacity-100"
            >
              <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function BookmarkFavicon({ url }: { url: string }) {
  const [failed, setFailed] = useState(false);
  const domain = useMemo(() => {
    try {
      if (!url || url === 'about:blank') return '';
      const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
      return parsed.hostname;
    } catch {
      return '';
    }
  }, [url]);

  if (domain && !failed) {
    const faviconUrl = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=32`;
    return (
      <img
        src={faviconUrl}
        alt=""
        onError={() => setFailed(true)}
        className="h-3.5 w-3.5 shrink-0 rounded-xs object-contain"
      />
    );
  }

  return <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />;
}

function extensionStatusLabel(extension: BrowserExtensionMetadata): string {
  if (extension.status === 'loaded') return 'Activa';
  if (extension.status === 'error') return 'Requiere atención';
  return 'Deshabilitada';
}
