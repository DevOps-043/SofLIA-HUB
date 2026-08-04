import { useCallback, useEffect, useState } from 'react';
import {
  voicePassiveService,
  type MicDeviceInfo,
  type VoicePassiveConfig,
  type VoicePassiveStatus,
} from '../services/voice-passive-service';

// Panel de configuración de la voz pasiva local (wake word con Vosk, sin nube).
// Se monta como tab "Voz" dentro de UnifiedSettingsModal.
export function VoicePassiveSettings() {
  const [status, setStatus] = useState<VoicePassiveStatus | null>(null);
  const [config, setConfig] = useState<VoicePassiveConfig | null>(null);
  const [wakeWordsInput, setWakeWordsInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [micDevices, setMicDevices] = useState<MicDeviceInfo[]>([]);
  const [testingMic, setTestingMic] = useState(false);
  const [micResult, setMicResult] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!voicePassiveService.isAvailable()) return;
    const snapshot = await voicePassiveService.getStatus();
    if (snapshot.success && snapshot.status && snapshot.config) {
      setStatus(snapshot.status);
      setConfig(snapshot.config);
      setWakeWordsInput((prev) => (prev === '' ? snapshot.config!.wakeWords.join(', ') : prev));
    }
    // Los microfonos cambian poco: cargar una sola vez.
    setMicDevices((prev) => {
      if (prev.length > 0) return prev;
      void voicePassiveService.listMicDevices()
        .then((res) => { if (res.success && res.devices) setMicDevices(res.devices); })
        .catch(() => undefined);
      return prev;
    });
  }, []);

  useEffect(() => {
    void refresh();
    const downloading = (status?.modelDownloadProgress ?? null) !== null;
    const interval = window.setInterval(() => { void refresh(); }, downloading ? 1000 : 4000);
    return () => window.clearInterval(interval);
  }, [refresh, status?.modelDownloadProgress]);

  if (!voicePassiveService.isAvailable()) {
    return (
      <div className="p-6 text-sm text-secondary">
        La voz pasiva no está disponible en este entorno (requiere la app de escritorio).
      </div>
    );
  }

  const modelInstalled = Boolean(status?.modelPath);
  const downloadProgress = status?.modelDownloadProgress ?? null;

  async function run(action: () => Promise<{ success: boolean; error?: string }>, okMessage: string) {
    setBusy(true);
    setFeedback(null);
    try {
      const result = await action();
      setFeedback(result.success ? okMessage : (result.error ?? 'Ocurrió un error inesperado.'));
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
      void refresh();
    }
  }

  function parsedWakeWords(): string[] {
    return wakeWordsInput.split(',').map((w) => w.trim().toLowerCase()).filter(Boolean);
  }

  async function handleTestMic(): Promise<void> {
    if (testingMic) return;
    setTestingMic(true);
    setMicResult('Habla ahora durante 3 segundos…');
    try {
      const result = await voicePassiveService.testMic(config?.micDevice ?? null);
      if (!result.success) {
        setMicResult(result.error ?? 'No se pudo probar el micrófono.');
      } else if (result.hasSignal) {
        setMicResult(`✓ Se detecta tu voz correctamente (pico ${result.peak}).`);
      } else {
        setMicResult(`✗ Casi no llega señal (pico ${result.peak}). Selecciona otro micrófono de la lista — probablemente tu diadema.`);
      }
    } catch (error) {
      setMicResult(error instanceof Error ? error.message : 'No se pudo probar el micrófono.');
    } finally {
      setTestingMic(false);
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <div>
        <h3 className="text-gray-900 dark:text-white text-lg font-semibold">Voz pasiva local</h3>
        <p className="text-xs text-secondary mt-1">
          SofLIA escucha la palabra de activación con un modelo 100% local (Vosk).
          Ningún audio sale de tu equipo hasta que dices la wake word; entonces se abre el modo voz.
        </p>
      </div>

      {/* Estado del sistema */}
      <div className="rounded-lg border border-border p-4 space-y-2 text-sm">
        <StatusRow label="Runtime Python" ok={Boolean(status?.runtimeAvailable)} okText="Instalado" failText="No instalado (reinstala la app o ejecuta npm run python:setup)" />
        <StatusRow
          label="Modelo de voz (español)"
          ok={modelInstalled}
          okText={status?.largeModelInstalled ? 'Instalado — grande (máxima precisión)' : 'Instalado — small'}
          failText="Pendiente de descarga (~39 MB)"
        />
        <StatusRow label="Escucha pasiva" ok={Boolean(status?.listening)} okText="Activa" failText="Inactiva" />
        {status?.lastError && (
          <p className="text-xs text-red-500 pt-1">Último error: {status.lastError}</p>
        )}
      </div>

      {/* Descarga del modelo */}
      {!modelInstalled && (
        <div className="rounded-lg border border-border p-4 space-y-3">
          <p className="text-sm text-secondary">
            El modelo de reconocimiento en español se descarga una sola vez (licencia Apache-2.0).
          </p>
          {downloadProgress !== null ? (
            <div className="space-y-1">
              <div className="h-2 rounded bg-border overflow-hidden">
                <div className="h-full bg-accent transition-all" style={{ width: `${downloadProgress}%` }} />
              </div>
              <p className="text-xs text-secondary">Descargando... {downloadProgress}%</p>
            </div>
          ) : (
            <button
              type="button"
              disabled={busy || !status?.runtimeAvailable}
              onClick={() => run(() => voicePassiveService.installModel(), 'Modelo instalado correctamente.')}
              className="px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium disabled:opacity-50"
            >
              Descargar modelo de voz
            </button>
          )}
        </div>
      )}

      {/* Mejorar precisión: modelo grande */}
      {modelInstalled && !status?.largeModelInstalled && (
        <div className="rounded-lg border border-border p-4 space-y-3">
          <div>
            <p className="text-sm font-medium text-gray-900 dark:text-white">Mejorar precisión de reconocimiento</p>
            <p className="text-xs text-secondary">
              Si SofLIA confunde palabras, instala el modelo grande de español (~1.4 GB de descarga,
              usa ~2 GB de RAM). Reconoce mucho mejor el habla natural y se activa automáticamente.
            </p>
          </div>
          {downloadProgress !== null ? (
            <div className="space-y-1">
              <div className="h-2 rounded bg-border overflow-hidden">
                <div className="h-full bg-accent transition-all" style={{ width: `${downloadProgress}%` }} />
              </div>
              <p className="text-xs text-secondary">Descargando modelo grande... {downloadProgress}%</p>
            </div>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={() => run(() => voicePassiveService.installModel('large'), 'Modelo grande instalado y activo.')}
              className="px-4 py-2 rounded-lg border border-border text-sm font-medium text-gray-900 dark:text-white disabled:opacity-50"
            >
              Descargar modelo grande (~1.4 GB)
            </button>
          )}
        </div>
      )}

      {/* Configuración */}
      <div className="rounded-lg border border-border p-4 space-y-4">
        <label className="flex items-center justify-between gap-4 cursor-pointer">
          <div>
            <p className="text-sm font-medium text-gray-900 dark:text-white">Activar voz pasiva</p>
            <p className="text-xs text-secondary">Escucha continua de la wake word al iniciar la app.</p>
          </div>
          <input
            type="checkbox"
            className="w-4 h-4 accent-current text-accent"
            checked={Boolean(config?.enabled)}
            disabled={busy || !status?.runtimeAvailable || !modelInstalled}
            onChange={(e) => run(
              () => voicePassiveService.setConfig({ enabled: e.target.checked }),
              e.target.checked ? 'Voz pasiva activada.' : 'Voz pasiva desactivada.',
            )}
          />
        </label>

        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-900 dark:text-white" htmlFor="mic-device">
            Micrófono
          </label>
          <p className="text-xs text-secondary">SofLIA escucha por este dispositivo. Si usas diadema, selecciónala aquí.</p>
          <div className="flex gap-2 items-center">
            <select
              id="mic-device"
              value={config?.micDevice === null || config?.micDevice === undefined ? '' : String(config.micDevice)}
              disabled={busy}
              onChange={(e) => {
                const value = e.target.value === '' ? null : Number(e.target.value);
                setMicResult(null);
                void run(
                  () => voicePassiveService.setConfig({ micDevice: value }),
                  'Micrófono actualizado.',
                );
              }}
              className="flex-1 px-3 py-2 rounded-lg border border-border bg-transparent text-sm text-gray-900 dark:text-white"
            >
              <option value="">Predeterminado del sistema</option>
              {micDevices.map((device) => (
                <option key={device.index} value={device.index}>
                  {device.name}{device.default ? ' (predeterminado)' : ''}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={testingMic || busy}
              onClick={() => void handleTestMic()}
              className="px-4 py-2 rounded-lg border border-border text-sm font-medium text-gray-900 dark:text-white disabled:opacity-50"
            >
              {testingMic ? 'Escuchando…' : 'Probar micrófono'}
            </button>
          </div>
          {micResult && (
            <p className={`text-xs ${micResult.startsWith('✓') ? 'text-emerald-500' : micResult.startsWith('✗') ? 'text-amber-500' : 'text-secondary'}`}>
              {micResult}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-900 dark:text-white" htmlFor="wake-words">
            Palabras de activación
          </label>
          <p className="text-xs text-secondary">Separadas por comas. Usa frases cortas en minúsculas.</p>
          <div className="flex gap-2">
            <input
              id="wake-words"
              type="text"
              value={wakeWordsInput}
              onChange={(e) => setWakeWordsInput(e.target.value)}
              placeholder="soflia, oye soflia"
              className="flex-1 px-3 py-2 rounded-lg border border-border bg-transparent text-sm text-gray-900 dark:text-white"
            />
            <button
              type="button"
              disabled={busy || parsedWakeWords().length === 0}
              onClick={() => run(
                () => voicePassiveService.setConfig({ wakeWords: parsedWakeWords() }),
                'Palabras de activación guardadas.',
              )}
              className="px-4 py-2 rounded-lg border border-border text-sm font-medium text-gray-900 dark:text-white disabled:opacity-50"
            >
              Guardar
            </button>
          </div>
        </div>
      </div>

      {feedback && <p className="text-xs text-secondary">{feedback}</p>}
    </div>
  );
}

function StatusRow({ label, ok, okText, failText }: { label: string; ok: boolean; okText: string; failText: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-gray-900 dark:text-white">{label}</span>
      <span className={`text-xs font-medium ${ok ? 'text-emerald-500' : 'text-secondary'}`}>
        <span className={`inline-block w-2 h-2 rounded-full mr-1.5 ${ok ? 'bg-emerald-500' : 'bg-gray-400'}`} />
        {ok ? okText : failText}
      </span>
    </div>
  );
}
