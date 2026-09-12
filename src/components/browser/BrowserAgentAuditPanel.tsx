import { useEffect, useRef, useState } from 'react';
import { integratedBrowserService, type BrowserAuditPage, type BrowserAuditRequest } from '../../services/integrated-browser-service';

const RESULTS: Record<string, string> = { started: 'Iniciada', completed: 'Terminada', failed: 'Falló', cancelled: 'Cancelada', allowed: 'Permitido', blocked: 'Bloqueado' };
const OPERATIONS: Record<string, string> = { dom: 'Observar página', document: 'Leer documento', capture: 'Capturar',
  click: 'Clic', type: 'Escribir', scroll: 'Desplazar', policy: 'Evaluar permiso', 'cu-capture': 'Observación visual',
  'cu-click': 'Clic visual', 'cu-double_click': 'Doble clic', 'cu-right_click': 'Clic derecho', 'cu-middle_click': 'Clic central',
  'cu-move': 'Mover puntero', 'cu-mouse_down': 'Presionar ratón', 'cu-mouse_up': 'Soltar ratón', 'cu-type': 'Escribir',
  'cu-key': 'Tecla', 'cu-scroll': 'Desplazar', 'cu-drag': 'Arrastrar', 'cu-wait': 'Esperar', 'cu-navigate': 'Navegar',
  'cu-go_back': 'Retroceder', 'cu-go_forward': 'Avanzar', 'cu-screenshot': 'Solicitud de captura', 'cu-desconocida': 'Sin acción compatible' };

export function BrowserAgentAuditPanel() {
  const [page, setPage] = useState<BrowserAuditPage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const generation = useRef(0);
  const pending = useRef(false);
  useEffect(() => {
    const current = ++generation.current;
    return () => { generation.current = current + 1; };
  }, []);
  const run = async (request: BrowserAuditRequest) => {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError(null); setNotice(null);
    const current = generation.current;
    try {
      const result = await integratedBrowserService.agentAudit(request);
      if (current !== generation.current) return;
      if (!result.success) { setError(result.error ?? 'No se pudo consultar la bitácora.'); return; }
      if (request.action === 'list') {
        if (!result.audit) { setError('No se recibió una bitácora válida.'); return; }
        setPage(result.audit);
      } else if (result.auditChange?.cancelled === false) {
        setPage(null); setNotice('Cambio confirmado. Actualiza la bitácora para consultar el estado.');
      }
    } catch { if (current === generation.current) setError('No se pudo consultar la bitácora. Vuelve a intentarlo.'); }
    finally { pending.current = false; if (current === generation.current) setBusy(false); }
  };
  return <section aria-label="Bitácora del agente" className="mt-5 space-y-3 border-t border-border pt-4">
    <h3 className="text-sm font-semibold">Bitácora cifrada del agente</h3>
    <p className="text-xs text-secondary">Sólo registra operaciones con gobierno avanzado activo. Conserva hasta 5.000 eventos; no guarda texto, formularios ni capturas. «Terminada» indica que la operación retornó, no que se cumplió el objetivo. Un inicio sin cierre indica interrupción.</p>
    <div className="flex flex-wrap gap-2">
      <button type="button" disabled={busy} className="soflia-browser-button" onClick={() => void run({ action: 'list', offset: 0 })}>Consultar bitácora</button>
      <button type="button" disabled={busy} className="soflia-browser-button" onClick={() => void run({ action: 'clear' })}>Borrar bitácora</button>
      <label className="text-xs">Retención
        <select aria-label="Retención de bitácora" value={page?.retentionDays ?? 30} disabled={busy} className="soflia-browser-field" onChange={(event) => void run({ action: 'retention', days: Number(event.target.value) as 7 | 30 | 90 })}>
          <option value={7}>7 días</option><option value={30}>30 días</option><option value={90}>90 días</option>
        </select>
      </label>
    </div>
    {busy && <p role="status">Consultando o esperando confirmación…</p>}
    {error && <p role="alert">{error}</p>}
    {notice && <p role="status">{notice}</p>}
    {page && <>
      <p className="text-xs">{page.total} eventos · retención de {page.retentionDays} días</p>
      {!page.entries.length && <p>No hay eventos en esta página.</p>}
      <ol className="space-y-2">{page.entries.map((entry) => <li key={entry.id} className="rounded-lg border border-border p-2 text-xs">
        <p>{new Date(entry.at).toLocaleString()} · {OPERATIONS[entry.operation] ?? 'Operación'} · {RESULTS[entry.result] ?? 'Resultado desconocido'}</p>
        <p className="break-all">{entry.origin ?? 'Página interna'} · pestaña {entry.tab.slice(0, 8)}</p>
        <p className="break-all">Traza: {entry.traceId}</p>
        {entry.confirmation !== 'none' && <p>Decisión humana: {entry.confirmation === 'accepted' ? 'aceptada' : 'rechazada'}</p>}
      </li>)}</ol>
      <div className="flex gap-2">
        <button type="button" disabled={busy || page.offset === 0} onClick={() => void run({ action: 'list', offset: Math.max(0, page.offset - 50) })}>Anterior</button>
        <button type="button" disabled={busy || page.offset + 50 >= page.total} onClick={() => void run({ action: 'list', offset: page.offset + 50 })}>Siguiente</button>
      </div>
    </>}
  </section>;
}
