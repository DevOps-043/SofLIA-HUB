import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { integratedBrowserService, type BrowserHistoryEntry } from '../../services/integrated-browser-service';
import { BrowserSitePermissionsPanel } from './BrowserSitePermissionsPanel';

const SUGGESTION_LIMIT = 8;
const SUGGESTION_DELAY_MS = 140;

export function BrowserAddressBar(props: {
  address: string;
  currentUrl?: string;
  onAddressChange: (value: string) => void;
  onEditingChange: (editing: boolean) => void;
  onNavigate: (target: string) => void;
  onSuggestionsVisibilityChange?: (visible: boolean) => void | Promise<void>;
}) {
  const requestIdRef = useRef(0);
  const suggestionsVisibleRef = useRef(false);
  const visibilityHandlerRef = useRef(props.onSuggestionsVisibilityChange);
  const [suggestions, setSuggestions] = useState<BrowserHistoryEntry[]>([]);
  const [open, setOpen] = useState(false);
  const [siteOpen, setSiteOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  visibilityHandlerRef.current = props.onSuggestionsVisibilityChange;

  useEffect(() => {
    if (!open || !integratedBrowserService.isAvailable()) return undefined;
    const requestId = ++requestIdRef.current;
    const timer = window.setTimeout(async () => {
      try {
        const response = await integratedBrowserService.listHistory(props.address.trim(), SUGGESTION_LIMIT);
        if (requestId !== requestIdRef.current) return;
        if (!response.success) {
          setSuggestions([]);
          return;
        }
        setSuggestions(dedupeSuggestions(response.history ?? []));
        setActiveIndex(-1);
      } catch {
        if (requestId === requestIdRef.current) setSuggestions([]);
      }
    }, SUGGESTION_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [open, props.address]);

  const navigate = (target: string) => {
    props.onAddressChange(target);
    props.onEditingChange(false);
    requestIdRef.current += 1;
    setOpen(false);
    setActiveIndex(-1);
    props.onNavigate(target);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const selected = suggestions[activeIndex];
    navigate(selected?.url ?? props.address);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      setOpen(false);
      setActiveIndex(-1);
      return;
    }
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    setOpen(true);
    setActiveIndex((current) => {
      if (suggestions.length === 0) return -1;
      const delta = event.key === 'ArrowDown' ? 1 : -1;
      return (current + delta + suggestions.length) % suggestions.length;
    });
  };

  const listVisible = open && suggestions.length > 0;
  const overlayVisible = listVisible || siteOpen;

  useEffect(() => {
    if (suggestionsVisibleRef.current === overlayVisible) return;
    suggestionsVisibleRef.current = overlayVisible;
    void visibilityHandlerRef.current?.(overlayVisible);
  }, [overlayVisible]);

  useEffect(() => () => {
    if (!suggestionsVisibleRef.current) return;
    suggestionsVisibleRef.current = false;
    void visibilityHandlerRef.current?.(false);
  }, []);

  return (
    <div className="relative min-w-[220px] flex-1">
      <form
        className="flex h-10 items-center rounded-xl border border-gray-200/80 bg-gray-50/90 px-2.5 shadow-inner transition-all duration-200 focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/20 focus-within:bg-white dark:border-white/[0.08] dark:bg-[#161b22]/80 dark:focus-within:bg-[#0d1117]"
        onSubmit={submit}
      >
        <label className="sr-only" htmlFor="integrated-browser-address">Dirección o búsqueda</label>
        <button
          type="button"
          aria-label="Permisos del sitio"
          aria-expanded={siteOpen}
          title="Permisos del sitio"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => { setSiteOpen((current) => !current); setOpen(false); }}
          className="mr-2 grid h-7 w-7 shrink-0 place-items-center rounded-lg text-gray-400 transition-all duration-200 hover:scale-105 hover:bg-gray-200/70 hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent dark:text-white/40 dark:hover:bg-white/[0.08] dark:hover:text-white/80"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </button>
        <input
          id="integrated-browser-address"
          value={props.address}
          onChange={(event) => { props.onEditingChange(true); props.onAddressChange(event.target.value); setActiveIndex(-1); setOpen(true); }}
          onFocus={(event) => { props.onEditingChange(true); setOpen(true); event.currentTarget.select(); }}
          onBlur={() => { props.onEditingChange(false); requestIdRef.current += 1; setOpen(false); setActiveIndex(-1); }}
          onKeyDown={handleKeyDown}
          role="combobox"
          aria-autocomplete="list"
          aria-controls="integrated-browser-suggestions"
          aria-expanded={listVisible}
          aria-activedescendant={activeIndex >= 0 ? `integrated-browser-suggestion-${activeIndex}` : undefined}
          className="min-w-0 flex-1 bg-transparent py-2 text-sm text-gray-800 outline-none dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
          placeholder="Buscar o escribir una dirección web"
          autoComplete="off"
          spellCheck={false}
        />
        <button
          type="submit"
          aria-label="Ir a la dirección"
          title="Ir a la página"
          className="group flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent text-on-accent shadow-xs transition-all duration-200 hover:scale-110 hover:shadow-md hover:shadow-accent/30 active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <svg className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </button>
      </form>

      <BrowserSitePermissionsPanel
        open={siteOpen}
        url={props.currentUrl ?? props.address}
        onClose={() => setSiteOpen(false)}
      />

      {listVisible && (
        <div id="integrated-browser-suggestions" role="listbox" aria-label="Sugerencias del historial" className="absolute left-0 top-[calc(100%+0.375rem)] z-[80] max-h-64 w-full max-w-[42rem] overflow-y-auto rounded-2xl border border-gray-200/80 bg-white/98 p-1.5 shadow-xl shadow-black/10 backdrop-blur-xl dark:border-white/[0.1] dark:bg-[#161b22]/98">
          {suggestions.map((entry, index) => (
            <button
              key={entry.id}
              id={`integrated-browser-suggestion-${index}`}
              type="button"
              role="option"
              aria-selected={activeIndex === index}
              onMouseDown={(event) => event.preventDefault()}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => navigate(entry.url)}
              className={`flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left transition-all duration-150 ${activeIndex === index ? 'bg-accent/[0.09]' : 'hover:bg-gray-100 dark:hover:bg-white/[0.05]'}`}
            >
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-accent/[0.08] text-accent">
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M7 17L17 7M8 7h9v9" /></svg>
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-semibold text-primary dark:text-white/90">{entry.title || entry.url}</span>
                <span className="block truncate text-[10px] text-secondary">{entry.url}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function dedupeSuggestions(entries: BrowserHistoryEntry[]): BrowserHistoryEntry[] {
  const seen = new Set<string>();
  return entries.filter((entry) => {
    if (seen.has(entry.url)) return false;
    seen.add(entry.url);
    return true;
  }).slice(0, SUGGESTION_LIMIT);
}
