import type { TabContextAttachment } from '../../../../services/integrated-browser-service';

interface TabAttachmentChipsProps {
  attachedTabs: TabContextAttachment[];
  onRemoveTab: (tabId: string) => void;
}

export function TabAttachmentChips({ attachedTabs, onRemoveTab }: TabAttachmentChipsProps) {
  if (!attachedTabs || attachedTabs.length === 0) return null;

  return (
    <div className="mb-1.5 flex flex-wrap gap-1.5 min-w-0">
      {attachedTabs.map((tab) => {
        const domain = getDomain(tab.url);
        const faviconUrl = domain ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=32` : null;

        return (
          <div
            key={tab.tabId}
            className="flex items-center gap-1.5 rounded-xl border border-accent/30 bg-accent/8 px-2.5 py-1 text-[11px] font-medium text-primary dark:text-white transition-all shadow-2xs"
          >
            <svg className="h-3.5 w-3.5 shrink-0 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3" y="4" width="18" height="16" rx="2" />
              <line x1="3" y1="9" x2="21" y2="9" />
            </svg>

            {faviconUrl && (
              <img
                src={faviconUrl}
                alt=""
                className="h-3 w-3 shrink-0 rounded-xs object-contain"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            )}

            <span className="truncate max-w-[140px]" title={tab.title || tab.url}>
              {tab.title || tab.url}
            </span>

            {tab.isCurrent && (
              <span className="shrink-0 text-[9px] font-semibold text-accent/80">
                (actual)
              </span>
            )}

            <button
              type="button"
              onClick={() => onRemoveTab(tab.tabId)}
              aria-label={`Quitar pestaña ${tab.title}`}
              title="Quitar pestaña"
              className="ml-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full text-secondary transition hover:bg-black/10 hover:text-danger dark:hover:bg-white/20"
            >
              <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        );
      })}
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
