import { useCallback, useEffect, useState } from 'react';
import { pythonToolsService, type PythonToolsStatus } from '../services/python-tools-service';

// Panel de privacidad: redacción local de datos personales antes de enviarlos a la nube.
// La redacción ocurre DENTRO del sidecar Python: el dato sensible nunca llega al modelo.
// Se monta como tab "Privacidad" dentro de UnifiedSettingsModal.
export function PrivacySettings() {
  const [status, setStatus] = useState<PythonToolsStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!pythonToolsService.isAvailable()) return;
    const snapshot = await pythonToolsService.getStatus();
    if (snapshot.success && snapshot.status) setStatus(snapshot.status);
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  if (!pythonToolsService.isAvailable()) {
    return (
      <div className="p-6 text-sm text-secondary">
        La configuración de privacidad no está disponible en este entorno (requiere la app de escritorio).
      </div>
    );
  }

  async function toggleRedaction(enabled: boolean): Promise<void> {
    setBusy(true);
    setFeedback(null);
    try {
      const result = await pythonToolsService.setPrivacyConfig({ redactDocuments: enabled });
      setFeedback(result.success
        ? (enabled
          ? 'Protección activada: los datos personales se sustituirán por marcadores antes de salir de tu equipo.'
          : 'Protección desactivada: los documentos se enviarán al modelo tal cual.')
        : (result.error ?? 'Ocurrió un error inesperado.'));
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
      void refresh();
    }
  }

  const runtimeAvailable = Boolean(status?.available);

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <div>
        <h3 className="text-gray-900 dark:text-white text-lg font-semibold">Privacidad de tus datos</h3>
        <p className="text-xs text-secondary mt-1">
          Cuando SofLIA lee un documento (PDF, Excel, PowerPoint o Word), el texto se envía al modelo de IA
          para poder responderte. Aquí decides si los datos personales viajan o se ocultan antes de salir de tu equipo.
        </p>
      </div>

      <div className="rounded-lg border border-border p-4 space-y-4">
        <label className="flex items-center justify-between gap-4 cursor-pointer">
          <div>
            <p className="text-sm font-medium text-gray-900 dark:text-white">
              Proteger datos personales antes de enviarlos a la nube
            </p>
            <p className="text-xs text-secondary">
              Sustituye RFC, CURP, CLABE, tarjetas, teléfonos y correos por marcadores
              (<span className="font-mono">[RFC]</span>, <span className="font-mono">[TARJETA]</span>…).
              La detección es 100% local.
            </p>
          </div>
          <input
            type="checkbox"
            className="w-4 h-4 accent-current text-accent"
            checked={Boolean(status?.privacy.redactDocuments)}
            disabled={busy || !runtimeAvailable}
            onChange={(e) => void toggleRedaction(e.target.checked)}
          />
        </label>

        {!runtimeAvailable && (
          <p className="text-xs text-amber-500">
            Requiere el runtime de Python (reinstala la app o ejecuta <span className="font-mono">npm run python:setup</span>).
          </p>
        )}

        {status?.privacy.redactDocuments && (
          <p className="text-xs text-secondary border-t border-border pt-3">
            Ten en cuenta que el modelo dejará de ver esos datos: si le pides
            &quot;dime el RFC del cliente&quot;, responderá que está oculto.
          </p>
        )}
      </div>

      {feedback && <p className="text-xs text-secondary">{feedback}</p>}
    </div>
  );
}
