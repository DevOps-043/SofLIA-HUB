import { useEffect, useState } from 'react';
import { integratedBrowserService, type BrowserTabSummary, type TabContextAttachment } from '../../../../services/integrated-browser-service';
import { BROWSER_SOURCE_LIMITS, browserSourceUrl } from '../../../../shared/browser-tab-context';

interface TabAttachmentPickerProps {
  attachedTabs: TabContextAttachment[];
  onToggleTab: (tab: TabContextAttachment) => void;
  onClose: () => void;
  onSelectFromScreen?: () => void;
  initialQuery?: string;
}

export function TabAttachmentPicker(props: TabAttachmentPickerProps) {
  const [tabs, setTabs] = useState<BrowserTabSummary[]>([]);
  const [profileRevision, setProfileRevision] = useState<number>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [search, setSearch] = useState({ initial: props.initialQuery, value: props.initialQuery ?? '' });
  if (search.initial !== props.initialQuery) setSearch({ initial: props.initialQuery, value: props.initialQuery ?? '' });
  const query = search.initial === props.initialQuery ? search.value : props.initialQuery ?? '';
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        if (!integratedBrowserService.isAvailable()) throw new Error('No disponible');
        const response = await integratedBrowserService.getTabSummaries();
        if (!active) return;
        if (!response.success || !response.summaries || response.state?.profileRevision === undefined) throw new Error('Sin selección vigente');
        setTabs(response.summaries); setProfileRevision(response.state.profileRevision);
      } catch { if (active) setError(true); }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [attempt]);
  const matches = tabs.filter((tab) => `${tab.title} ${tab.url}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  return (
    <div role="dialog" aria-label="Añadir pestañas al chat" onKeyDown={(event) => {
      if (event.key === 'Escape') { event.preventDefault(); props.onClose(); }
    }} className="w-80 max-w-full rounded-2xl border border-border bg-card p-3 text-primary shadow-lg">
      <div className="flex items-center justify-between">
        <span>Añadir pestañas ({props.attachedTabs.length}/{BROWSER_SOURCE_LIMITS.tabs})</span>
        <button type="button" aria-label="Cerrar selector de pestañas" onClick={props.onClose}>×</button>
      </div>
      <p className="my-2 text-xs text-secondary">Se enviarán hasta tres extractos por pestaña al modelo y se conservarán con el chat. No incluye la página completa.</p>
      <p className="mb-2 text-xs text-secondary">Sólo texto disponible, sin búsquedas adicionales ni acciones externas. Una Skill activa puede trabajar en su workspace.</p>
      <input aria-label="Buscar pestañas por título o sitio" type="search" value={query} onChange={(event) => setSearch({ initial: props.initialQuery, value: event.target.value })} className="mb-2 w-full rounded border border-border bg-background p-2 text-sm" />
      {loading ? <p role="status">Obteniendo pestañas…</p> : error ? (
        <div role="alert">No se pudieron obtener las pestañas. <button type="button" onClick={() => { setLoading(true); setError(false); setAttempt((value) => value + 1); }}>Reintentar</button></div>
      ) : (
        <div className="max-h-56 overflow-y-auto">
          {!matches.length && <p className="text-sm text-secondary">No hay pestañas coincidentes.</p>}
          {matches.map((tab) => {
            const selected = props.attachedTabs.some((item) => item.tabId === tab.tabId);
            const available = Boolean(tab.documentToken && browserSourceUrl(tab.url));
            return (
              <button key={tab.tabId} type="button" data-tab-choice aria-pressed={selected}
                disabled={!available || (!selected && props.attachedTabs.length >= BROWSER_SOURCE_LIMITS.tabs)}
                onClick={() => props.onToggleTab({ ...tab, text: '', expected: { profileRevision: profileRevision!, documentToken: tab.documentToken! } })}
                className="my-1 block w-full rounded-lg p-2 text-left hover:bg-accent/10 disabled:opacity-40">
                <span className="block truncate text-sm">{selected ? '✓ ' : '▣ '}{tab.title || 'Sin título'}{tab.isCurrent ? ' · Actual' : ''}</span>
                <span className="block truncate text-xs text-secondary">{available ? tab.url : 'Contenido no disponible para adjuntar'}</span>
              </button>
            );
          })}
        </div>
      )}
      {props.onSelectFromScreen && <button type="button" className="mt-2 text-sm" onClick={() => { props.onSelectFromScreen?.(); props.onClose(); }}>Seleccionar de la pantalla</button>}
    </div>
  );
}
