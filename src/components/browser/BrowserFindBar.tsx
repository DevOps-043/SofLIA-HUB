import { useEffect, useRef, useState } from 'react';
import type { BrowserFindState } from '../../services/integrated-browser-service';

export function BrowserFindBar(props: {
  result: BrowserFindState | null;
  onFind: (query: string, forward: boolean) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState(props.result?.query ?? '');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); inputRef.current?.select(); }, []);

  const search = (forward: boolean) => props.onFind(query, forward);
  const counter = props.result && props.result.query === query
    ? `${props.result.activeMatchOrdinal || 0} de ${props.result.matches}`
    : '0 de 0';

  return (
    <form
      role="search"
      aria-label="Buscar en esta página"
      className="ml-auto flex w-full max-w-md items-center gap-1 rounded-xl border border-border bg-card p-1 shadow-sm"
      onSubmit={(event) => { event.preventDefault(); search(true); }}
    >
      <label className="sr-only" htmlFor="browser-find-input">Buscar en esta página</label>
      <input
        ref={inputRef}
        id="browser-find-input"
        value={query}
        maxLength={500}
        placeholder="Buscar en esta página"
        onChange={(event) => { setQuery(event.target.value); props.onFind(event.target.value, true); }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') { event.preventDefault(); props.onClose(); }
          if (event.key === 'Enter' && event.shiftKey) { event.preventDefault(); search(false); }
        }}
        className="min-w-0 flex-1 bg-transparent px-2 py-1 text-xs text-primary outline-none dark:text-white"
      />
      <span className="shrink-0 px-1 text-[10px] tabular-nums text-secondary" aria-live="polite">{counter}</span>
      <FindButton label="Coincidencia anterior" onClick={() => search(false)}><path d="M7 14l5-5 5 5" /></FindButton>
      <FindButton label="Coincidencia siguiente" onClick={() => search(true)}><path d="M7 10l5 5 5-5" /></FindButton>
      <FindButton label="Cerrar búsqueda" onClick={props.onClose}><path d="M6 6l12 12M18 6L6 18" /></FindButton>
    </form>
  );
}

function FindButton(props: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" aria-label={props.label} title={props.label} onClick={props.onClick} className="soflia-browser-icon-button h-7 w-7">
      <svg viewBox="0 0 24 24" aria-hidden="true">{props.children}</svg>
    </button>
  );
}
