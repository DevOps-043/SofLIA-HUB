import { useEffect, useRef, useState } from 'react';
import { integratedBrowserService } from '../../services/integrated-browser-service';
import { BROWSER_SHORTCUT_LIMITS, type BrowserAgentShortcut, type BrowserShortcutLibrary, type BrowserShortcutRequest } from '../../shared/browser-agent-shortcuts';

const emptyEntry = (): BrowserAgentShortcut => ({ id: '', title: '', instruction: '', scope: 'selected-tabs', permission: 'read-fragments' });

export function BrowserAgentShortcutsPanel(props: { onUse: (entry: BrowserAgentShortcut, profileRevision: number) => void; onClose: () => void }) {
  const [loaded, setLoaded] = useState<{ library: BrowserShortcutLibrary; profile: number } | null>(null);
  const [entry, setEntry] = useState(emptyEntry);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const alive = useRef(false); const pending = useRef(false); const epoch = useRef(0);
  const profile = useRef<number | null>(null);
  const closeButton = useRef<HTMLButtonElement>(null);

  const refresh = async () => {
    const state = await integratedBrowserService.getState();
    const revision = state.state?.profileRevision;
    if (!state.success || revision === undefined) throw new Error('No se pudo verificar el perfil.');
    if (!alive.current) throw new Error('Panel cerrado.');
    profile.current = revision;
    const response = await integratedBrowserService.agentShortcuts({ action: 'list', profileRevision: revision });
    if (!response.success || !response.library) throw new Error(response.error || 'No se pudieron cargar los atajos.');
    return { library: response.library, profile: revision };
  };

  useEffect(() => {
    const lifecycleEpoch = epoch;
    closeButton.current?.focus();
    alive.current = true; const generation = ++epoch.current;
    void refresh().then(value => {
      if (alive.current && generation === epoch.current) { profile.current = value.profile; setLoaded(value); }
    }).catch(() => { if (alive.current && generation === epoch.current) setError('No se pudieron cargar los atajos. Revisa el perfil y la disponibilidad del gobierno del agente.'); });
    const unsubscribe = integratedBrowserService.subscribe({ onStateChanged: state => {
      if (profile.current !== null && state.profileRevision !== profile.current) {
        epoch.current++; profile.current = null; setLoaded(null); setEntry(emptyEntry()); setError('El perfil cambió. Actualiza la lista.');
      }
    } });
    return () => { alive.current = false; lifecycleEpoch.current++; unsubscribe(); };
  }, []);

  const perform = async (request?: BrowserShortcutRequest) => {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError(null); const generation = epoch.current;
    try {
      if (!request) {
        const value = await refresh();
        if (alive.current && generation === epoch.current) { profile.current = value.profile; setLoaded(value); setEntry(emptyEntry()); }
      } else {
        const response = await integratedBrowserService.agentShortcuts(request);
        if (!response.success) throw new Error(response.error || 'No se pudo guardar el cambio.');
        if (alive.current && generation === epoch.current && !response.canceled) {
          if (!response.library) throw new Error('No se recibió la biblioteca actualizada.');
          setLoaded({ library: response.library, profile: request.profileRevision }); setEntry(emptyEntry());
        }
      }
    } catch (cause) { if (alive.current && generation === epoch.current) setError(cause instanceof Error ? cause.message : 'No se pudo completar la operación.'); }
    finally { pending.current = false; if (alive.current) setBusy(false); }
  };

  return <section role="dialog" aria-label="Atajos del navegador" onKeyDown={event => { if (event.key === 'Escape') props.onClose(); }} className="max-h-[70vh] w-80 overflow-auto rounded-2xl border border-border bg-surface-2 p-4 text-primary">
    <h3>Atajos del navegador</h3>
    <p className="my-2 text-xs text-secondary">Sólo analizar fragmentos de pestañas elegidas en cada uso. No navegan ni actúan en sitios. Revisa y envía el borrador manualmente. No guardes secretos.</p>
    <button ref={closeButton} type="button" onClick={props.onClose}>Cerrar atajos</button>{' '}
    <button type="button" disabled={busy} onClick={() => void perform()}>Actualizar lista</button>
    {error && <p role="alert" className="my-2 text-danger">{error}</p>}
    {!loaded && !error && <p role="status">Cargando atajos…</p>}
    {loaded && <>
      {!loaded.library.entries.length && <p className="my-2 text-sm">Todavía no hay atajos.</p>}
      <ul>{loaded.library.entries.map(item => <li key={item.id} className="my-3 border-b border-border pb-2">
        <span>{item.title}</span>
        <div className="flex gap-3 text-sm">
          <button type="button" disabled={busy} onClick={() => { try { props.onUse(item, loaded.profile); } catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo preparar el atajo.'); } }}>Usar {item.title}</button>
          <button type="button" disabled={busy} onClick={() => setEntry(item)}>Editar {item.title}</button>
          <button type="button" disabled={busy} onClick={() => void perform({ action: 'remove', profileRevision: loaded.profile, revision: loaded.library.revision, id: item.id })}>Eliminar {item.title}</button>
        </div>
      </li>)}</ul>
      <form onSubmit={event => { event.preventDefault(); void perform({ action: 'save', profileRevision: loaded.profile, revision: loaded.library.revision, entry }); }}>
        <fieldset disabled={busy} className="space-y-2">
          <label className="block">Nombre del atajo<input className="w-full border border-border bg-surface p-2" required maxLength={BROWSER_SHORTCUT_LIMITS.title} value={entry.title} onChange={event => setEntry({ ...entry, title: event.target.value })} /></label>
          <label className="block">Instrucciones<textarea className="w-full border border-border bg-surface p-2" required maxLength={BROWSER_SHORTCUT_LIMITS.instruction} rows={4} value={entry.instruction} onChange={event => setEntry({ ...entry, instruction: event.target.value })} /></label>
          <button type="submit">{busy ? 'Guardando…' : entry.id ? 'Guardar cambios' : 'Crear atajo'}</button>{' '}
          {entry.id && <button type="button" onClick={() => setEntry(emptyEntry())}>Cancelar edición</button>}
        </fieldset>
      </form>
    </>}
  </section>;
}
