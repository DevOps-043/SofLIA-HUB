import { useEffect, useRef, useState } from 'react';
import type { BrowserFavorite } from './use-browser-bookmarks';
import { integratedBrowserService, type BrowserHistoryEntry } from '../../services/integrated-browser-service';

export interface SofLIAEcosystemApp {
  id: string;
  title: string;
  url: string;
  iconUrl?: string;
  fallbackIcon?: 'learning' | 'engine' | 'hub' | 'globe';
}

export interface RecurrentSite {
  id: string;
  url: string;
  title: string;
  domain: string;
  visitCount: number;
  lastVisitedAt: string;
}

export const DEFAULT_SOFLIA_APPS: SofLIAEcosystemApp[] = [
  {
    id: 'soflia-learning',
    title: 'SOFLIA LEARNING',
    url: 'https://soflia.ai',
    fallbackIcon: 'learning',
  },
  {
    id: 'soflia-engine',
    title: 'SofLIA Engine',
    url: 'https://soflia-coursegen.netlify.app/',
    fallbackIcon: 'engine',
  },
  {
    id: 'project-hub',
    title: 'Project Hub',
    url: 'https://irisia.netlify.app/',
    fallbackIcon: 'hub',
  },
];

export const DEFAULT_RECURRENT_FALLBACKS: RecurrentSite[] = [
  { id: 'def-yt', title: 'YouTube', url: 'https://www.youtube.com', domain: 'youtube.com', visitCount: 1, lastVisitedAt: new Date().toISOString() },
  { id: 'def-chatgpt', title: 'ChatGPT', url: 'https://chatgpt.com', domain: 'chatgpt.com', visitCount: 1, lastVisitedAt: new Date().toISOString() },
  { id: 'def-gmail', title: 'Gmail', url: 'https://mail.google.com', domain: 'mail.google.com', visitCount: 1, lastVisitedAt: new Date().toISOString() },
  { id: 'def-github', title: 'GitHub', url: 'https://github.com', domain: 'github.com', visitCount: 1, lastVisitedAt: new Date().toISOString() },
  { id: 'def-google', title: 'Google', url: 'https://www.google.com', domain: 'google.com', visitCount: 1, lastVisitedAt: new Date().toISOString() },
  { id: 'def-canva', title: 'Canva', url: 'https://www.canva.com', domain: 'canva.com', visitCount: 1, lastVisitedAt: new Date().toISOString() },
];

interface BrowserAppGridMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNavigate: (url: string) => void;
  favorites?: BrowserFavorite[];
}

export function BrowserAppGridMenu({ open, onOpenChange, onNavigate, favorites = [] }: BrowserAppGridMenuProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [recurrentSites, setRecurrentSites] = useState<RecurrentSite[]>(() =>
    computeRecurrentSites([], favorites)
  );

  useEffect(() => {
    if (!open) return undefined;

    const handleOutsideClick = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        onOpenChange(false);
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onOpenChange(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleEscape);

    // Calcular analítica de sitios recurrentes a partir del historial real del usuario
    if (integratedBrowserService.isAvailable()) {
      integratedBrowserService.listHistory('', 200).then((res) => {
        if (res.success && Array.isArray(res.history)) {
          const computed = computeRecurrentSites(res.history, favorites);
          setRecurrentSites(computed);
        }
      }).catch(() => undefined);
    } else {
      setRecurrentSites(computeRecurrentSites([], favorites));
    }

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open, onOpenChange, favorites]);

  return (
    <div ref={containerRef} className="relative shrink-0">
      <button
        type="button"
        aria-label="Herramientas del Ecosistema SofLIA"
        title="Herramientas del Ecosistema SofLIA"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => onOpenChange(!open)}
        className={`grid h-8.5 w-8.5 place-items-center rounded-lg transition-all duration-200 hover:scale-105 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
          open
            ? 'bg-accent/15 text-accent shadow-xs shadow-accent/20 font-semibold'
            : 'text-gray-600 hover:bg-white hover:text-accent hover:shadow-xs dark:text-white/70 dark:hover:bg-white/[0.1] dark:hover:text-accent'
        }`}
      >
        {/* Icono de rejilla 3x3 (Waffle / Apps Menu Icon) */}
        <svg
          className="h-4 w-4 transition-transform duration-200 group-hover:scale-110"
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden="true"
        >
          <circle cx="6" cy="6" r="2" />
          <circle cx="12" cy="6" r="2" />
          <circle cx="18" cy="6" r="2" />
          <circle cx="6" cy="12" r="2" />
          <circle cx="12" cy="12" r="2" />
          <circle cx="18" cy="12" r="2" />
          <circle cx="6" cy="18" r="2" />
          <circle cx="12" cy="18" r="2" />
          <circle cx="18" cy="18" r="2" />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Aplicaciones del Ecosistema SofLIA"
          className="absolute right-0 top-[calc(100%+0.5rem)] z-[90] flex max-h-[32rem] w-[21.5rem] flex-col overflow-hidden rounded-2xl border border-gray-200/90 dark:border-white/12 bg-white/98 dark:bg-[#11161d]/98 p-3.5 shadow-[0_1.75rem_4.5rem_rgba(2,12,23,0.36)] backdrop-blur-2xl animate-in fade-in slide-in-from-top-2 duration-150"
          style={{ fontFamily: 'var(--font-system-ui)' }}
        >
          {/* Fondo de resplandor sutil */}
          <div className="absolute right-0 top-0 h-32 w-32 rounded-full bg-accent/8 blur-2xl pointer-events-none" aria-hidden="true" />

          <div className="no-scrollbar min-h-0 overflow-y-auto space-y-4 pr-0.5">
            {/* Sección: Ecosistema SofLIA */}
            <div>
              <div
                className="px-1 pb-2 text-[10px] font-extrabold uppercase tracking-[0.16em] text-gray-400 dark:text-white/40 flex items-center justify-between"
                style={{ fontFamily: 'var(--font-system-label)' }}
              >
                <span>Ecosistema SofLIA</span>
                <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
              </div>
              <div className="grid grid-cols-3 gap-2">
                {DEFAULT_SOFLIA_APPS.map((app) => (
                  <GridAppTile
                    key={app.id}
                    title={app.title}
                    url={app.url}
                    fallbackIcon={app.fallbackIcon}
                    onSelect={() => {
                      onNavigate(app.url);
                      onOpenChange(false);
                    }}
                  />
                ))}
              </div>
            </div>

            {/* Sección: Sitios Recurrentes y Frecuentes (Basado en Historial y Analítica de Uso) */}
            <div className="border-t border-gray-200/70 dark:border-white/10 pt-3">
              <div
                className="px-1 pb-2 text-[10px] font-extrabold uppercase tracking-[0.16em] text-gray-400 dark:text-white/40 flex items-center justify-between"
                style={{ fontFamily: 'var(--font-system-label)' }}
              >
                <span>Sitios Recurrentes</span>
                <span className="text-[9px] font-normal text-gray-400 dark:text-white/30 lowercase">más visitados</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {recurrentSites.map((site) => (
                  <GridAppTile
                    key={site.id}
                    title={site.title}
                    url={site.url}
                    onSelect={() => {
                      onNavigate(site.url);
                      onOpenChange(false);
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function GridAppTile({
  title,
  url,
  fallbackIcon,
  onSelect,
}: {
  title: string;
  url: string;
  fallbackIcon?: 'learning' | 'engine' | 'hub' | 'globe';
  onSelect: () => void;
}) {
  const [imageError, setImageError] = useState(false);
  const faviconUrl = getFaviconUrl(url);

  return (
    <button
      type="button"
      role="menuitem"
      onClick={onSelect}
      className="group flex flex-col items-center justify-center gap-1.5 rounded-xl p-2 transition-all duration-150 hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      title={`${title} (${url})`}
    >
      <div className="relative flex h-11 w-11 items-center justify-center rounded-2xl border border-gray-200/70 dark:border-white/10 bg-white dark:bg-white/[0.07] shadow-xs transition-all duration-150 group-hover:scale-105 group-hover:border-accent/40 group-hover:shadow-md">
        {!imageError && faviconUrl ? (
          <img
            src={faviconUrl}
            alt={title}
            className="h-6 w-6 object-contain rounded-md"
            onError={() => setImageError(true)}
          />
        ) : (
          <RenderFallbackIcon type={fallbackIcon} />
        )}
      </div>
      <span className="w-full truncate text-[11px] font-semibold text-gray-800 dark:text-white/90 group-hover:text-accent leading-tight">
        {title}
      </span>
    </button>
  );
}

function RenderFallbackIcon({ type }: { type?: 'learning' | 'engine' | 'hub' | 'globe' }) {
  if (type === 'learning') {
    return (
      <svg className="h-5 w-5 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
        <path d="M6 12v5c3 3 9 3 12 0v-5" />
      </svg>
    );
  }
  if (type === 'engine') {
    return (
      <svg className="h-5 w-5 text-amber-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
      </svg>
    );
  }
  if (type === 'hub') {
    return (
      <svg className="h-5 w-5 text-indigo-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
      </svg>
    );
  }
  return (
    <svg className="h-5 w-5 text-gray-400 dark:text-white/50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M3.6 9h16.8M3.6 15h16.8M12 3a14.5 14.5 0 0 1 0 18M12 3a14.5 14.5 0 0 0 0 18" />
    </svg>
  );
}

/**
 * Algoritmo de cálculo de sitios recurrentes más frecuentes basado en frecuencia de visitas reales y hábitos.
 */
export function computeRecurrentSites(
  history: BrowserHistoryEntry[] = [],
  favorites: BrowserFavorite[] = [],
  limit = 9
): RecurrentSite[] {
  const map = new Map<string, RecurrentSite>();

  // 1. Procesar visitas de historial
  for (const entry of history) {
    if (!entry || !entry.url) continue;
    let urlObj: URL;
    try {
      urlObj = new URL(entry.url);
    } catch {
      continue;
    }

    if (urlObj.protocol !== 'http:' && urlObj.protocol !== 'https:') continue;

    const hostname = urlObj.hostname.replace(/^www\./, '').toLowerCase();
    const originUrl = `${urlObj.protocol}//${urlObj.hostname}`;
    const cleanTitle = getCleanTitle(entry.title, hostname, urlObj);

    const existing = map.get(hostname);
    if (existing) {
      existing.visitCount += 1;
      if (entry.visitedAt && Date.parse(entry.visitedAt) > Date.parse(existing.lastVisitedAt)) {
        existing.lastVisitedAt = entry.visitedAt;
        if (cleanTitle && cleanTitle !== hostname) {
          existing.title = cleanTitle;
        }
      }
    } else {
      map.set(hostname, {
        id: `recurrent-${hostname}`,
        url: originUrl,
        title: cleanTitle,
        domain: hostname,
        visitCount: 1,
        lastVisitedAt: entry.visitedAt || new Date().toISOString(),
      });
    }
  }

  // 2. Incorporar marcadores favoritos explícitos
  for (const fav of favorites) {
    if (!fav || !fav.url) continue;
    let urlObj: URL;
    try {
      urlObj = new URL(fav.url);
    } catch {
      continue;
    }
    const hostname = urlObj.hostname.replace(/^www\./, '').toLowerCase();
    const cleanTitle = getCleanTitle(fav.title, hostname, urlObj);
    if (!map.has(hostname)) {
      map.set(hostname, {
        id: `fav-${fav.id}`,
        url: fav.url,
        title: cleanTitle,
        domain: hostname,
        visitCount: 3, // Favorito guardado explícitamente cuenta como recurrente
        lastVisitedAt: fav.createdAt || new Date().toISOString(),
      });
    } else {
      const existing = map.get(hostname)!;
      existing.visitCount += 2;
    }
  }

  // 3. Excluir herramientas por defecto del Ecosistema SofLIA
  const defaultDomains = new Set(['soflia.ai', 'soflia-coursegen.netlify.app', 'irisia.netlify.app']);
  let list = Array.from(map.values()).filter((item) => !defaultDomains.has(item.domain));

  // 4. FILTRAR SITIOS DE HISTORIAL POCO RECURRENTES (requiere mínimo 3 visitas o marcador favorito)
  const trulyRecurrent = list.filter((item) => item.visitCount >= 3);

  if (trulyRecurrent.length > 0) {
    list = trulyRecurrent;
  } else {
    // Si no hay sitios con 3+ visitas, filtrar sitios con al menos 2 visitas
    const min2Visits = list.filter((item) => item.visitCount >= 2);
    if (min2Visits.length > 0) {
      list = min2Visits;
    } else {
      // Si el historial está completamente nuevo, mostrar sugerencias populares por defecto
      list = DEFAULT_RECURRENT_FALLBACKS;
    }
  }

  // 5. Ordenar estrictamente por mayor número de visitas como criterio primario
  const now = Date.now();
  list.sort((a, b) => {
    if (b.visitCount !== a.visitCount) {
      return b.visitCount - a.visitCount; // Mayor número de visitas primero
    }
    const ageAInDays = Math.max(0.1, (now - Date.parse(a.lastVisitedAt || '')) / (1000 * 60 * 60 * 24));
    const ageBInDays = Math.max(0.1, (now - Date.parse(b.lastVisitedAt || '')) / (1000 * 60 * 60 * 24));
    return ageAInDays - ageBInDays;
  });

  return list.slice(0, limit);
}

function getCleanTitle(rawTitle: string | undefined, hostname: string, urlObj?: URL): string {
  const host = hostname.toLowerCase();

  // Mapeos conocidos de servicios y herramientas de alta frecuencia
  if (host.includes('mail.google.com') || (urlObj && urlObj.pathname.includes('/mail/'))) return 'Gmail';
  if (host.includes('docs.google.com')) return 'Google Docs';
  if (host.includes('calendar.google.com')) return 'Google Calendar';
  if (host.includes('drive.google.com')) return 'Google Drive';
  if (host.includes('meet.google.com')) return 'Google Meet';
  if (host.includes('youtube.com')) return 'YouTube';
  if (host.includes('chatgpt.com') || host.includes('openai.com')) return 'ChatGPT';
  if (host.includes('github.com')) return 'GitHub';
  if (host.includes('cnn.com')) return 'CNN';
  if (host.includes('ycombinator.com') || host.includes('ycrootaccess')) return 'Y Combinator';
  if (host === 'google.com' || host === 'www.google.com') return 'Google';
  if (host.includes('canva.com')) return 'Canva';
  if (host.includes('wikipedia.org')) return 'Wikipedia';

  if (rawTitle) {
    // Quitar conteos de notificaciones entre paréntesis como (1,234) o (3)
    let clean = rawTitle.replace(/\(\d+[^)]*\)/g, '').trim();
    // Quitar sufijos de sitio web después de guiones o barras verticales
    clean = clean.split(/[-–—|•]/)[0]?.trim() || '';

    // Ignorar títulos feos o rutas de URL
    if (clean && clean.length >= 2 && clean.length <= 25 && !clean.includes('http')) {
      return clean;
    }
  }

  const domainName = host.split('.')[0];
  return domainName.charAt(0).toUpperCase() + domainName.slice(1);
}

function getFaviconUrl(url: string): string | null {
  try {
    const domain = new URL(url).hostname;
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`;
  } catch {
    return null;
  }
}
