import { useCallback, useEffect, useState } from 'react';
import { integratedBrowserService, type BrowserHistoryRetention, type BrowserRecentlyClosedTab } from '../../services/integrated-browser-service';
import { BrowserConfirmDialog } from './BrowserDialog';

export function BrowserHistorySettings({ onChanged, onClose }: { onChanged: () => void; onClose: () => void }) {
  const [retention, setRetention] = useState<BrowserHistoryRetention | null>(null);
  const [selected, setSelected] = useState('all');
  const [closedTabs, setClosedTabs] = useState<BrowserRecentlyClosedTab[]>([]);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [settings, recent] = await Promise.all([
      integratedBrowserService.getHistoryRetention(), integratedBrowserService.listRecentlyClosedTabs(),
    ]);
    if (!settings.success || !settings.historyRetention) throw new Error(settings.error || 'No se pudo leer la retención.');
    if (!recent.success) throw new Error(recent.error || 'No se pudieron leer las pestañas cerradas.');
    setRetention(settings.historyRetention);
    setSelected(settings.historyRetention.days === null ? 'all' : String(settings.historyRetention.days));
    setClosedTabs(recent.recentlyClosedTabs ?? []);
  }, []);
  useEffect(() => { void Promise.resolve().then(load).catch((failure: unknown) => setError(message(failure))); }, [load]);

  const apply = async () => {
    setBusy(true); setError(null); setNotice(null);
    try {
      const response = await integratedBrowserService.setHistoryRetention(selected === 'all' ? null : Number(selected));
      if (!response.success || !response.historyRetention) throw new Error(response.error || 'No se pudo aplicar la retención.');
      setRetention(response.historyRetention);
      setNotice(`Retención actualizada. ${response.historyRetention.removed ?? 0} visitas eliminadas.`);
      setConfirming(false);
      await load(); onChanged();
    } catch (failure) { setError(message(failure)); }
    finally { setBusy(false); }
  };

  const reopen = async (id: string) => {
    setBusy(true); setError(null);
    try {
      const response = await integratedBrowserService.reopenClosedTab(id);
      if (!response.success) throw new Error(response.error || 'No se pudo reabrir la pestaña.');
      onClose();
    } catch (failure) { setError(message(failure)); }
    finally { setBusy(false); }
  };

  const importHistory = async () => {
    setBusy(true); setError(null); setNotice(null);
    try {
      const response = await integratedBrowserService.importHistory();
      if (!response.success || !response.historyTransfer) throw new Error(response.error || 'No se pudo importar el historial.');
      const transfer = response.historyTransfer;
      if (!transfer.cancelled) {
        setNotice(`Importación completada: ${transfer.imported ?? 0} visitas nuevas, ${transfer.skipped ?? 0} omitidas, ${transfer.duplicates ?? 0} duplicadas y ${transfer.invalid ?? 0} inválidas.`);
        await load(); onChanged();
      }
    } catch (failure) { setError(message(failure)); }
    finally { setBusy(false); }
  };

  return <section aria-label="Conservación del historial" className="mb-4 space-y-3 rounded-2xl border border-border p-3">
    <form className="flex flex-wrap items-end gap-2" onSubmit={(event) => { event.preventDefault(); setConfirming(true); }}>
      <label className="min-w-0 flex-1 text-xs">Conservar visitas
        <select aria-label="Retención del historial" className="soflia-browser-field mt-1" value={selected} disabled={!retention || retention.managed || busy} onChange={(event) => setSelected(event.target.value)}>
          <option value="all">Sin límite temporal</option>
          {[30, 90, 180, 365].map((days) => <option key={days} value={String(days)}>{days} días</option>)}
          {retention?.managed && retention.days !== null && ![30, 90, 180, 365].includes(retention.days) && <option value={String(retention.days)}>{retention.days} días (administrado)</option>}
        </select>
      </label>
      <button className="soflia-browser-button px-3" disabled={!retention || retention.managed || busy || selected === (retention.days === null ? 'all' : String(retention.days))}>Aplicar retención</button>
    </form>
    <p className="text-[11px] text-secondary">{retention?.managed ? 'Administrado por tu organización. ' : ''}Máximo 50 000 visitas. La limpieza automática se ejecuta al consultar o registrar actividad.</p>
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" className="soflia-browser-button px-3" disabled={!retention || busy} onClick={() => void importHistory()}>Importar historial</button>
      <span className="text-[11px] text-secondary">JSON/JSONL de hasta 5 MB; se revisa antes de escribir.</span>
    </div>
    <details className="rounded-xl bg-surface-2 p-2">
      <summary className="cursor-pointer text-xs">Cerradas recientemente ({closedTabs.length})</summary>
      <p className="my-2 text-[11px] text-secondary">Hasta 25 pestañas de esta sesión; se vacían al cambiar de cuenta o borrar el historial correspondiente.</p>
      <div className="max-h-44 space-y-1 overflow-y-auto">
        {closedTabs.map((tab) => <button key={tab.id} type="button" disabled={busy} onClick={() => void reopen(tab.id)} aria-label={`Reabrir ${tab.title || tab.url}`} className="block w-full rounded-lg px-2 py-2 text-left text-xs hover:bg-accent/10">
          <span className="block truncate font-medium">{tab.title || tab.url}</span><span className="block truncate text-[10px] text-secondary">{tab.url}</span>
        </button>)}
      </div>
    </details>
    {error && <p role="alert" className="text-xs text-danger">{error}</p>}
    {notice && <p role="status" className="text-xs text-secondary">{notice}</p>}
    {confirming && <BrowserConfirmDialog title="Cambiar retención del historial"
      description={selected === 'all' ? 'Se dejará de borrar por antigüedad; se conserva el límite de 50 000 visitas.' : `Se eliminarán ahora y en futuras limpiezas las visitas de más de ${selected} días.`}
      detail={selected === 'all' ? 'Las visitas eliminadas anteriormente no se recuperarán. Se retiran las copias locales anteriores de recuperación.' : 'No se puede deshacer. El respaldo del historial antiguo y las copias locales de recuperación se eliminan completos. Marcadores, contraseñas y pestañas abiertas no se modifican.'}
      confirmLabel="Confirmar retención" busy={busy} onCancel={() => setConfirming(false)} onConfirm={() => void apply()} />}
  </section>;
}

function message(failure: unknown): string { return failure instanceof Error ? failure.message : 'No se pudo completar la operación de historial.'; }
