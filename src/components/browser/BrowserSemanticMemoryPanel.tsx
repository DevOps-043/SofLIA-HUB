import { useEffect, useRef, useState } from 'react';
import { integratedBrowserService } from '../../services/integrated-browser-service';
import type { BrowserSemanticRequest, BrowserSemanticResponse } from '../../shared/browser-semantic-memory';

export function BrowserSemanticMemoryPanel() {
  const profile = useRef<number | null>(null); const generation = useRef(0); const pending = useRef(false);
  const [result, setResult] = useState<BrowserSemanticResponse | null>(null);
  const [query, setQuery] = useState(''); const [busy, setBusy] = useState(false); const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isWorking = busy || result?.status?.busy === true;
  useEffect(() => {
    let alive = true; let received = false;
    const invalidate = () => { generation.current++; };
    const receive = (revision?: number) => {
      if (!alive || revision === profile.current) return;
      generation.current++; profile.current = revision ?? null; pending.current = false;
      setResult(null); setQuery(''); setBusy(false); setError(null); setReady(revision !== undefined);
    };
    const cleanup = integratedBrowserService.subscribe({ onStateChanged: state => { received = true; receive(state.profileRevision); } });
    void integratedBrowserService.getState().then(response => { if (!received && response.success) receive(response.state?.profileRevision); }).catch(() => { if (alive) setError('No se pudo consultar el perfil. Cierra y abre el panel.'); });
    return () => { alive = false; invalidate(); cleanup(); };
  }, []);
  const run = async (action: BrowserSemanticRequest['action']) => {
    if (profile.current === null || (pending.current && action !== 'cancel')) return;
    const current = ++generation.current; const revision = profile.current;
    pending.current = true; setBusy(true); setError(null);
    try {
      const request: BrowserSemanticRequest = action === 'search' ? { action, query, profileRevision: revision } : { action, profileRevision: revision };
      const response = await integratedBrowserService.semanticMemoryCommand(request);
      if (generation.current !== current) return;
      if (!response.success) setError(response.error ?? 'No se pudo completar la memoria.');
      else if (response.canceled) { setResult(null); setError('Operación cancelada. Consulta el estado antes de continuar.'); }
      else setResult(response);
    } catch { if (generation.current === current) setError('No se pudo completar la memoria.'); }
    finally { if (generation.current === current) { pending.current = false; setBusy(false); } }
  };
  return <section aria-label="Memoria semántica" className="mt-5 space-y-3 border-t border-border pt-4">
    <h3 className="text-sm font-semibold">Buscar por significado</h3>
    <p className="text-xs text-secondary">Opcional y sólo para tu perfil persistente. Google recibe títulos, rutas URL sin parámetros y consultas: pueden contener datos personales y generar costes. No recibe páginas ni formularios. Hasta 200 visitas y 200 marcadores; índice cifrado local, sin sincronización, caduca a los 30 días. No se reconstruye automáticamente.</p>
    <div className="flex flex-wrap gap-2">
      <button type="button" disabled={!ready || busy} className="soflia-browser-button" onClick={() => void run('status')}>Consultar memoria</button>
      <button type="button" disabled={!ready || isWorking || result?.status?.enabled === true} className="soflia-browser-button" onClick={() => void run('enable')}>Activar con consentimiento</button>
      <button type="button" disabled={!ready || isWorking || !result?.status?.enabled} className="soflia-browser-button" onClick={() => void run('rebuild')}>Reconstruir índice</button>
      <button type="button" disabled={!ready || isWorking} className="soflia-browser-button" onClick={() => void run('disable')}>Desactivar y borrar índice</button>
      {isWorking && <button type="button" className="soflia-browser-button" onClick={() => void run('cancel')}>Cancelar operación</button>}
    </div>
    <form className="flex gap-2" onSubmit={event => { event.preventDefault(); void run('search'); }}>
      <input aria-label="Consulta semántica" className="soflia-browser-field" value={query} maxLength={500} disabled={isWorking} onChange={event => setQuery(event.target.value)} placeholder="Por ejemplo: aprender fotografía nocturna" />
      <button type="submit" disabled={isWorking || !result?.status?.enabled || !query.trim()}>Buscar</button>
    </form>
    {isWorking && <p role="status">Procesando o esperando confirmación. Cancelar no retira datos ya enviados.</p>}
    {error && <p role="alert">{error}</p>}
    {result?.status && <p className="text-xs">{result.status.enabled ? 'Activa' : 'Desactivada'} · {result.status.count} fuentes{result.status.indexedAt ? ` · ${new Date(result.status.indexedAt).toLocaleString()}` : ' · Sin índice vigente'}</p>}
    {result?.results && <><p className="text-xs">La similitud orienta la búsqueda, no verifica el contenido.</p>
      {!result.results.length && <p>No hay fuentes vigentes coincidentes. Reconstruye si agregaste contenido.</p>}
      <ol className="space-y-2">{result.results.map(entry => <li key={`${entry.source}:${entry.id}`} className="rounded-lg border border-border p-2 text-xs">
        <p>{entry.source === 'bookmark' ? 'Marcador' : 'Historial'} · {entry.title || 'Sin título'}</p>
        <p className="break-all">{entry.url}</p>
      </li>)}</ol></>}
  </section>;
}
