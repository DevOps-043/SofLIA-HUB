import { useCallback, useEffect, useRef, useState } from 'react';
import { pythonToolsService, type PythonToolsStatus } from '../services/python-tools-service';

/** Preferencia de este equipo; no afirma redacción integral de todas las fuentes del Hub. */
export function PrivacySettings() {
  const [status, setStatus] = useState<PythonToolsStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const generation = useRef(0); const active = useRef(false); const changing = useRef(false);
  const available = pythonToolsService.isAvailable();
  const refresh = useCallback(async () => {
    if (!available) return;
    const version = ++generation.current;
    try {
      const snapshot = await pythonToolsService.getStatus();
      if (!active.current || version !== generation.current) return;
      if (snapshot.success && snapshot.status) setStatus(snapshot.status);
      else { setStatus(null); setFeedback(snapshot.error ?? 'No se pudo cargar la preferencia de privacidad.'); }
    } catch {
      if (active.current && version === generation.current) { setStatus(null); setFeedback('No se pudo cargar la preferencia de privacidad.'); }
    }
  }, [available]);
  useEffect(() => {
    active.current = true; let disposed = false;
    queueMicrotask(() => { if (!disposed) void refresh(); });
    return () => { disposed = true; active.current = false; };
  }, [refresh]);
  async function toggleRedaction(enabled: boolean): Promise<void> {
    if (changing.current || !status) return; changing.current = true; setBusy(true); setFeedback(null);
    const version = generation.current;
    try {
      const result = await pythonToolsService.setPrivacyConfig({ redactDocuments: enabled });
      if (!active.current || version !== generation.current) return;
      setFeedback(result.success ? (enabled ? 'Preferencia guardada: se aplicará redacción por patrones en las lecturas documentales protegidas.' : 'Preferencia guardada: las lecturas de documentos podrán devolver contenido sin redactar.')
        : result.error ?? 'No se pudo confirmar el guardado de privacidad.');
    } catch {
      if (active.current && version === generation.current) setFeedback('No se pudo confirmar el guardado de privacidad.');
    } finally { changing.current = false; if (active.current) { setBusy(false); void refresh(); } }
  }
  if (!available) return <div className="p-6 text-sm text-secondary">La configuración de privacidad requiere la aplicación de escritorio.</div>;
  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <div>
        <h3 className="text-gray-900 dark:text-white text-lg font-semibold">Privacidad de documentos de este equipo</h3>
        <p className="text-xs text-secondary mt-1">La preferencia se aplica al lector local de PDF, Excel, PowerPoint y Word. No pertenece a una cuenta individual.</p>
      </div>
      <div className="rounded-lg border border-border p-4 space-y-4">
        {status ? (
          <label className="flex items-center justify-between gap-4 cursor-pointer">
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">Redactar datos personales en documentos</p>
              <p className="text-xs text-secondary">Detección local por patrones de RFC, CURP, CLABE, tarjetas, teléfonos y correos. Puede omitir datos personales; no garantiza anonimización completa.</p>
            </div>
            <input type="checkbox" className="w-4 h-4 accent-current text-accent" checked={status.privacy.redactDocuments} disabled={busy} onChange={event => void toggleRedaction(event.target.checked)} />
          </label>
        ) : <p className="text-xs text-secondary">La preferencia aún no está disponible; no se ha cambiado la protección.</p>}
        {status && !status.available && <p className="text-xs text-warning">Falta el runtime Python. Puedes guardar la protección; las lecturas protegidas se rechazarán hasta que el lector esté disponible.</p>}
        <p className="text-xs text-secondary">La protección no cubre imágenes, capturas de otras aplicaciones, texto manual ni todas las fuentes del Hub. En documentos Office protegidos se omite la imagen de apoyo y se rechaza el respaldo sin redactar cuando falla el lector.</p>
        {!status && <button type="button" className="text-xs text-accent" disabled={busy} onClick={() => void refresh()}>Reintentar cargar privacidad</button>}
      </div>
      {feedback && <p role="status" className="text-xs text-secondary">{feedback}</p>}
    </div>
  );
}
