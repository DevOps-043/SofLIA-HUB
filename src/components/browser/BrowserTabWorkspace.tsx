import { useRef, useState, type KeyboardEvent } from 'react';
import { integratedBrowserService, type BrowserTabGroup, type BrowserTabGroupColor, type IntegratedBrowserTabState } from '../../services/integrated-browser-service';

import { GROUP_COLORS } from './tab-group-colors';

export function BrowserVerticalTabs(props: {
  tabs: IntegratedBrowserTabState[];
  groups: BrowserTabGroup[];
  activeTabId: string | null;
  onActivate: (id: string) => void;
  onClose: (id: string) => void;
  onReorder: (source: string, target: string) => void;
}) {
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  const handleKey = (event: KeyboardEvent, tab: IntegratedBrowserTabState) => {
    const index = props.tabs.findIndex((item) => item.id === tab.id);
    if (event.key === 'Delete') { event.preventDefault(); props.onClose(tab.id); return; }
    const delta = event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0;
    const target = event.key === 'Home' ? 0 : event.key === 'End' ? props.tabs.length - 1 : delta ? (index + delta + props.tabs.length) % props.tabs.length : -1;
    if (target < 0) return;
    event.preventDefault();
    const next = props.tabs[target];
    if (event.ctrlKey && event.shiftKey && delta) props.onReorder(tab.id, next.id);
    else { buttons.current.get(next.id)?.focus(); props.onActivate(next.id); }
  };
  return <aside className="w-48 shrink-0 overflow-y-auto border-r border-border bg-surface-2 p-2 dark:bg-[#0d1117]" aria-label="Panel de pestañas verticales">
    <p className="px-2 pb-2 text-xs text-secondary">Pestañas · {props.tabs.length}</p>
    <div role="tablist" aria-label="Pestañas del navegador" aria-orientation="vertical" className="space-y-1">
      {props.tabs.map((tab) => {
        const group = props.groups.find((item) => item.id === tab.groupId);
        return <div key={tab.id} className="flex items-center gap-1 rounded-lg border-l-2" style={{ borderColor: group ? GROUP_COLORS[group.color].hex : 'transparent' }}>
          <button type="button" role="tab" aria-selected={tab.id === props.activeTabId} tabIndex={tab.id === props.activeTabId ? 0 : -1}
            ref={(node) => { if (node) buttons.current.set(tab.id, node); else buttons.current.delete(tab.id); }}
            onKeyDown={(event) => handleKey(event, tab)} onClick={() => props.onActivate(tab.id)}
            title={tab.title || tab.url} className="min-w-0 flex-1 rounded-lg px-2 py-2 text-left text-xs text-primary hover:bg-accent/10 focus-visible:ring-2 focus-visible:ring-accent aria-selected:bg-accent/15 dark:text-white/85">
            <span className="block truncate">{tab.pinned ? '📌 ' : ''}{tab.title || 'Nueva pestaña'}{tab.muted ? ' · silenciada' : ''}</span>
            {group && <span className="block truncate text-[10px] text-secondary">{group.name}</span>}
          </button>
          <button type="button" aria-label={`Cerrar ${tab.title || 'pestaña'}`} onClick={() => props.onClose(tab.id)} className="px-2 text-secondary hover:text-danger">×</button>
        </div>;
      })}
    </div>
    <p className="mt-3 px-2 text-[10px] text-secondary">↑ ↓ para cambiar · Supr para cerrar · Ctrl + Mayús + ↑ ↓ para mover.</p>
  </aside>;
}

export function BrowserGroupEditor(props: { tabId: string; groups: BrowserTabGroup[]; onClose: () => void; onChanged: () => void }) {
  const [name, setName] = useState('');
  const [color, setColor] = useState<BrowserTabGroupColor>('blue');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const save = async (existing?: string | null) => {
    setBusy(true); setError(null);
    try {
      let groupId = existing;
      if (groupId === undefined) {
        const response = await integratedBrowserService.createTabGroup(name, color);
        if (!response.success || !response.group) throw new Error(response.error || 'No se pudo crear el grupo.');
        groupId = response.group.id;
      }
      const response = await integratedBrowserService.assignTabGroup(props.tabId, groupId);
      if (!response.success) throw new Error(response.error || 'No se pudo asignar la pestaña.');
      props.onChanged(); props.onClose();
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'No se pudo guardar el grupo.'); }
    finally { setBusy(false); }
  };
  return <form aria-label="Grupo de pestañas" className="flex flex-wrap items-end gap-2 rounded-xl border border-border p-3"
    onSubmit={(event) => { event.preventDefault(); void save(); }} onKeyDown={(event) => { if (event.key === 'Escape') props.onClose(); }}>
    <label className="text-xs">Nombre del grupo<input autoFocus required maxLength={80} value={name} onChange={(event) => setName(event.target.value)} className="soflia-browser-field block" /></label>
    <label className="text-xs">Color del grupo<select value={color} onChange={(event) => setColor(event.target.value as BrowserTabGroupColor)} className="soflia-browser-field block">
      {Object.entries(GROUP_COLORS).map(([value, meta]) => <option key={value} value={value}>{meta.label}</option>)}
    </select></label>
    <button disabled={busy || !name.trim()} className="soflia-browser-button px-3">Crear y asignar</button>
    {props.groups.length > 0 && <label className="text-xs">Grupo existente<select value="" disabled={busy} className="soflia-browser-field block" onChange={(event) => { if (event.target.value) void save(event.target.value); }}>
      <option value="">Seleccionar…</option>{props.groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
    </select></label>}
    <button type="button" disabled={busy} className="soflia-browser-button px-3" onClick={() => void save(null)}>Quitar del grupo</button>
    <button type="button" className="soflia-browser-button px-3" onClick={props.onClose}>Cerrar editor</button>
    {error && <p role="alert" className="w-full text-xs text-danger">{error}</p>}
  </form>;
}
