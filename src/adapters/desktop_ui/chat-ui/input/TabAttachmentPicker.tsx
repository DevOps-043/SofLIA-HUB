import { useEffect, useState } from 'react';
import {
  integratedBrowserService,
  type BrowserTabSummary,
  type TabContextAttachment,
} from '../../../../services/integrated-browser-service';

interface TabAttachmentPickerProps {
  attachedTabs: TabContextAttachment[];
  onToggleTab: (tab: TabContextAttachment) => void;
  onClose: () => void;
  onSelectFromScreen?: () => void;
}

export function TabAttachmentPicker(props: TabAttachmentPickerProps) {
  const [tabSummaries, setTabSummaries] = useState<BrowserTabSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        setLoading(true);
        if (!integratedBrowserService.isAvailable()) {
          setError('El navegador integrado no está disponible');
          return;
        }
        const res = await integratedBrowserService.getTabSummaries();
        if (active) {
          if (res.success && res.summaries) {
            setTabSummaries(res.summaries);
          } else {
            setError(res.error || 'No se pudieron obtener las pestañas');
          }
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : 'Error al cargar pestañas');
        }
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  const isSelected = (tabId: string) => {
    return props.attachedTabs.some((t) => t.tabId === tabId);
  };

  const handleTabClick = (summary: BrowserTabSummary) => {
    props.onToggleTab({
      tabId: summary.tabId,
      url: summary.url,
      title: summary.title,
      text: summary.text,
      isCurrent: summary.isCurrent,
    });
  };

  return (
    <div
      role="dialog"
      aria-label="Añadir pestañas al chat"
      className="w-80 overflow-hidden rounded-2xl border border-gray-200/60 bg-white/95 p-2 shadow-[0_12px_40px_rgba(0,0,0,0.14)] backdrop-blur-xl dark:border-white/[0.08] dark:bg-[#161B22]/95 dark:shadow-[0_12px_48px_rgba(0,0,0,0.6)]"
      style={{ fontFamily: 'var(--font-system-ui)' }}
    >
      <div className="flex items-center justify-between px-3 py-1.5 text-[12px] font-semibold text-gray-500 dark:text-gray-400">
        <span>Añadir pestañas</span>
        <span className="text-[10px] text-accent font-medium">Multi-pestaña</span>
      </div>

      <div className="my-1 border-t border-gray-100 dark:border-white/[0.06]" />

      {loading ? (
        <div className="flex items-center justify-center py-6 text-[12px] text-gray-400">
          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-accent border-r-transparent mr-2" />
          Obteniendo pestañas...
        </div>
      ) : error ? (
        <div className="px-3 py-4 text-center text-[12px] text-gray-400">
          {error}
        </div>
      ) : tabSummaries.length === 0 ? (
        <div className="px-3 py-4 text-center text-[12px] text-gray-400">
          No hay pestañas abiertas en el navegador.
        </div>
      ) : (
        <div className="max-h-56 overflow-y-auto space-y-1 pr-0.5">
          {tabSummaries.map((tab) => {
            const selected = isSelected(tab.tabId);
            const domain = getDomain(tab.url);
            const faviconUrl = domain ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=32` : null;

            return (
              <button
                key={tab.tabId}
                type="button"
                onClick={() => handleTabClick(tab)}
                className={`w-full flex items-center justify-between gap-2.5 rounded-xl px-2.5 py-2 text-left transition ${
                  selected
                    ? 'bg-accent/10 text-accent font-medium'
                    : 'text-gray-800 hover:bg-gray-100/80 dark:text-white/90 dark:hover:bg-white/[0.05]'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  {faviconUrl ? (
                    <img
                      src={faviconUrl}
                      alt=""
                      className="h-4 w-4 shrink-0 rounded-xs object-contain"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <svg className="h-4 w-4 shrink-0 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <rect x="3" y="4" width="18" height="16" rx="2" />
                    </svg>
                  )}
                  <div className="min-w-0 flex-1">
                    <span className="block truncate text-[12px] leading-tight font-medium">
                      {tab.title || tab.url}
                    </span>
                    {tab.isCurrent && (
                      <span className="inline-block mt-0.5 text-[10px] text-gray-400 dark:text-gray-400 font-normal">
                        • Pestaña actual
                      </span>
                    )}
                  </div>
                </div>

                <div className="shrink-0 flex items-center">
                  {selected ? (
                    <span className="grid h-4.5 w-4.5 place-items-center rounded-full bg-accent text-white">
                      <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </span>
                  ) : (
                    <span className="h-4 w-4 rounded-full border border-gray-300 dark:border-white/20" />
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {props.onSelectFromScreen && (
        <>
          <div className="my-1 border-t border-gray-100 dark:border-white/[0.06]" />
          <button
            type="button"
            onClick={() => {
              props.onSelectFromScreen?.();
              props.onClose();
            }}
            className="w-full flex items-center justify-between rounded-xl px-2.5 py-2 text-left text-gray-700 hover:bg-gray-100/80 dark:text-white/80 dark:hover:bg-white/[0.05] transition"
          >
            <div className="flex items-center gap-2.5 text-[12px] font-medium">
              <svg className="h-4 w-4 text-accent shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 8V4h4M20 8V4h-4M4 16v4h4M20 16v4h-4" />
              </svg>
              <span>Seleccionar de la pantalla</span>
            </div>
            <span className="rounded-md bg-accent/15 px-1.5 py-0.5 text-[9px] font-bold tracking-wider text-accent uppercase">
              NUEVO
            </span>
          </button>
        </>
      )}
    </div>
  );
}

function getDomain(url: string): string {
  try {
    if (!url || url === 'about:blank') return '';
    const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
    return parsed.hostname;
  } catch {
    return '';
  }
}
