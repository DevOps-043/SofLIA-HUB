import { useCallback, useEffect, useRef, useState } from 'react';
import { integratedBrowserService, type BrowserSyncCategory, type BrowserSyncControlRequest, type BrowserSyncControlStatus } from '../../services/integrated-browser-service';

const labels: Record<BrowserSyncCategory, string> = { bookmarks: 'Marcadores', groups: 'Grupos', tabs: 'Pestañas', settings: 'Disposición de pestañas' };
const button = 'rounded-xl border border-border px-3 py-2 text-sm disabled:opacity-50';
export function BrowserSyncControls() {
  const [status, setStatus] = useState<BrowserSyncControlStatus | null>(null);
  const [categories, setCategories] = useState<BrowserSyncCategory[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const mounted = useRef(false);
  const locked = useRef(false);
  const run = useCallback(async (input: BrowserSyncControlRequest) => {
    if (locked.current) return;
    locked.current = true; setBusy(true); setError(null); setNotice(null);
    try {
      const result = await integratedBrowserService.controlSync(input);
      if (!mounted.current) return;
      if (!result.success || !result.sync) { setStatus(null); setError(result.error || 'No se pudo completar la sincronización.'); }
      else { setStatus(result.sync); setCategories(result.sync.categories); if (result.sync.canceled) setNotice('Operación no confirmada.');
        else if (input.action === 'recover-settings') setNotice('Configuración recuperada con transferencia desactivada. Consulta de nuevo y revisa las categorías antes de habilitarlas.');
        else if (input.action === 'recover-state') setNotice('Seguimiento recuperado con transferencia desactivada. Los originales se archivaron cifrados; vuelve a comparar versiones antes de sincronizar.');
        else if (input.action === 'rollback-state') setNotice('Archivos anteriores restaurados. El daño original puede seguir presente; no se enviaron datos al servidor.'); }
    } catch { if (mounted.current) { setStatus(null); setError('No se pudo consultar la sincronización.'); } }
    finally { locked.current = false; if (mounted.current) setBusy(false); }
  }, []);
  useEffect(() => {
    mounted.current = true; let active = true;
    void Promise.resolve().then(() => { if (active) void run({ action: 'status' }); });
    return () => { active = false; mounted.current = false; void integratedBrowserService.cancelSyncOperation().catch(() => undefined); };
  }, [run]);
  return <section aria-label="Datos sincronizados" aria-busy={busy} className="space-y-3 border-t border-border pt-4">
    <h3 className="font-semibold">Datos sincronizados</h3>
    <p className="text-sm text-secondary">Registra el dispositivo, crea o importa la clave y elige las categorías. La sincronización se ejecuta al pulsar el botón; no envía datos en segundo plano.</p>
    <p className="text-xs text-secondary">El código de recuperación permite descifrar tus datos. Consérvalo fuera del chat. Las URLs sincronizadas omiten consultas y fragmentos; los títulos y etiquetas pueden contener información personal.</p>
    {error && <p role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}
    {status && <p role="status" className="text-sm">{!status.enabled ? 'Capacidad deshabilitada en esta instalación o perfil.' : status.state === 'idle' ? 'Sincronización completada.' : status.state === 'local-changed' ? 'Los datos cambiaron mientras sincronizabas. Revisa y vuelve a intentarlo.' : status.state === 'conflict' || status.state === 'initial-review' ? 'Hay diferencias que requieren tu decisión.' : status.categories.length ? 'Configurada; lista para ejecutar.' : 'Sin categorías activas.'}</p>}
    <div className="flex flex-wrap gap-2">
      <button className={button} disabled={busy} onClick={() => void run({ action: 'status' })}>Consultar configuración</button>
      <button className={button} disabled={busy || status?.enabled === false} onClick={() => void run({ action: 'recover-settings' })}>Recuperar configuración dañada</button>
      <button className={button} disabled={busy || status?.enabled === false} onClick={() => void run({ action: 'recover-state' })}>Recuperar checkpoints y conflictos</button>
      <button className={button} disabled={busy || status?.enabled === false} onClick={() => void run({ action: 'rollback-state' })}>Revertir recuperación incompleta</button>
      <button className={button} disabled={busy || !status?.enabled} onClick={() => void run({ action: 'export-key' })}>{status?.keyAvailable ? 'Exportar código de recuperación' : 'Crear clave y guardar código'}</button>
      <button className={button} disabled={busy || !status?.enabled} onClick={() => void run({ action: 'import-key' })}>Importar código de recuperación</button>
    </div>
    <fieldset disabled={busy || !status?.enabled || !status.keyAvailable} className="flex flex-wrap gap-4"><legend className="text-sm">Categorías permitidas</legend>
      {(Object.keys(labels) as BrowserSyncCategory[]).map((category) => <label key={category} className="text-sm"><input type="checkbox" checked={categories.includes(category)} onChange={(event) => setCategories((current) => event.target.checked ? [...current, category] : current.filter((item) => item !== category))} /> {labels[category]}</label>)}
    </fieldset>
    <div className="flex flex-wrap gap-2">
      <button className={button} disabled={busy || !status?.enabled || !status.keyAvailable} onClick={() => void run({ action: 'configure', categories })}>Aplicar categorías</button>
      <button className={button} disabled={busy || !status?.categories.length} onClick={() => void run({ action: 'run' })}>Sincronizar ahora</button>
      <button className={button} disabled={busy || !status?.categories.length} onClick={() => void run({ action: 'pause' })}>Desactivar transferencia</button>
      {busy && <button className={button} onClick={() => void integratedBrowserService.cancelSyncOperation().then((result) => { if (!result.success && mounted.current) setError('No se pudo cancelar.'); }).catch(() => { if (mounted.current) setError('No se pudo cancelar.'); })}>Cancelar transferencia</button>}
    </div>
    {status?.lastSyncedAt && <p className="text-xs text-secondary">Última ejecución completa: {new Date(status.lastSyncedAt).toLocaleString('es-MX')}</p>}
    {status?.initialCategories.map((category) => <div key={category} className="space-y-2 rounded-xl border border-border p-3"><p>Revisión de versiones de {labels[category]}: {status.state === 'local-changed' ? 'hubo cambios locales después de publicar.' : 'no existe una base común confirmada.'} Elige qué versión conservar.</p>
      {(['local', 'remote'] as const).map((choice) => <button key={choice} disabled={busy} className={button} onClick={() => void run({ action: 'resolve', category, choice })}>{choice === 'local' ? 'Conservar datos locales' : 'Usar datos remotos'}</button>)}
    </div>)}
    {status?.conflicts.map((review) => <div key={review.reviewId} className="space-y-2 rounded-xl border border-border p-3"><p>{labels[review.category]}: {review.count} diferencias pendientes. La elección se aplicará a todas las diferencias de esta revisión.</p>
      {(['local', 'remote'] as const).map((choice) => <button key={choice} disabled={busy} className={button} onClick={() => void run({ action: 'resolve', category: review.category, reviewId: review.reviewId, choice })}>{choice === 'local' ? 'Preferir versiones locales' : 'Preferir versiones remotas'}</button>)}
    </div>)}
  </section>;
}
