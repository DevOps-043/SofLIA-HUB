import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { SectionHeader } from '../ui/SectionHeader';
import SelectDropdown from '../ui/SelectDropdown';
import { TextField } from '../ui/TextField';
import { Toggle } from '../ui/Toggle';
import { cn } from '../ui/cn';
import type { VoicePassivePanel } from './useVoicePassivePanel';

const MIC_DEFAULT_VALUE = 'system-default';

/** Controles de la escucha: activacion, microfono y palabras de activacion. */
export function ListeningCard({ panel }: { panel: VoicePassivePanel }) {
  const {
    status, config, micDevices, loadingDevices, busy, testingMic, micResult,
    modelInstalled, wakeWordsInput, parsedWakeWords,
    setEnabled, setMicDevice, setWakeWordsInput, saveWakeWords, refreshDevices, testMic,
  } = panel;

  const runtimeReady = Boolean(status?.runtimeAvailable);
  const canListen = runtimeReady && modelInstalled;
  const micValue = config?.micDevice === null || config?.micDevice === undefined
    ? MIC_DEFAULT_VALUE
    : String(config.micDevice);

  const micOptions = [
    { value: MIC_DEFAULT_VALUE, label: 'Predeterminado del sistema', description: 'Sigue el dispositivo activo del sistema operativo.' },
    ...micDevices.map((device) => ({
      value: String(device.index),
      label: device.name,
      description: device.default ? 'Dispositivo predeterminado ahora mismo' : undefined,
    })),
  ];

  const savedWakeWords = config?.wakeWords ?? [];
  const wakeWordsDirty = parsedWakeWords.join(',') !== savedWakeWords.join(',');

  return (
    <Card className="space-y-6">
      <SectionHeader
        title="Escucha y activación"
        subtitle="Define cómo y por dónde te escucha SofLIA."
        icon={<MicIcon className="w-4.5 h-4.5" />}
      />

      {/* El switch vive junto a su etiqueta y descripcion, nunca dentro del track (§12.6). */}
      <div className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-surface-2 px-4 py-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-900 dark:text-white">Activar voz pasiva</p>
          <p className="text-xs text-secondary mt-0.5">
            {canListen
              ? 'Escucha continua de la palabra de activación al iniciar la app.'
              : 'Disponible cuando el runtime y el modelo de voz estén instalados.'}
          </p>
        </div>
        <Toggle
          checked={Boolean(config?.enabled)}
          disabled={busy || !canListen}
          onChange={setEnabled}
          aria-label="Activar voz pasiva"
        />
      </div>

      {/* Microfono */}
      <Field
        label="Micrófono"
        htmlFor="voice-mic-device"
        hint="SofLIA escucha por este dispositivo. Si usas diadema, selecciónala aquí."
        action={(
          <button
            type="button"
            onClick={() => void refreshDevices()}
            disabled={!runtimeReady || loadingDevices}
            className="text-[11px] font-medium text-accent hover:underline disabled:opacity-40 disabled:no-underline focus:outline-none focus-visible:ring-[3px] focus-visible:ring-accent/15 rounded px-1"
          >
            {loadingDevices ? 'Buscando…' : 'Actualizar lista'}
          </button>
        )}
      >
        <div className="flex flex-col sm:flex-row gap-2">
          <SelectDropdown
            id="voice-mic-device"
            className="flex-1"
            value={micValue}
            options={micOptions}
            disabled={busy || !runtimeReady}
            // El menu vive en un portal, fuera del alcance del <label>: necesita nombre propio.
            aria-label="Micrófono"
            onChange={(value) => setMicDevice(value === MIC_DEFAULT_VALUE ? null : Number(value))}
          />
          <Button
            variant="secondary"
            size="md"
            disabled={testingMic || busy || !runtimeReady}
            loading={testingMic}
            onClick={testMic}
            className="sm:w-auto shrink-0"
          >
            {testingMic ? 'Escuchando…' : 'Probar micrófono'}
          </Button>
        </div>

        {runtimeReady && micDevices.length === 0 && !loadingDevices && (
          <p className="text-xs text-secondary">
            No se encontraron micrófonos. Conecta uno y pulsa «Actualizar lista».
          </p>
        )}

        {micResult && (
          <p
            className={cn(
              'flex items-start gap-1.5 text-xs',
              micResult.tone === 'ok' ? 'text-success'
                : micResult.tone === 'warn' ? 'text-warning' : 'text-secondary',
            )}
          >
            {micResult.tone !== 'info' && (
              <span aria-hidden="true" className="shrink-0 mt-px">
                {micResult.tone === 'ok' ? '✓' : '!'}
              </span>
            )}
            <span>{micResult.message}</span>
          </p>
        )}
      </Field>

      {/* Wake words */}
      <Field
        label="Palabras de activación"
        htmlFor="voice-wake-words"
        hint="Separadas por comas. Frases cortas en minúsculas funcionan mejor."
      >
        <div className="flex flex-col sm:flex-row gap-2">
          <TextField
            id="voice-wake-words"
            value={wakeWordsInput}
            onChange={(event) => setWakeWordsInput(event.target.value)}
            placeholder="soflia, oye soflia"
            wrapperClassName="flex-1"
          />
          <Button
            variant={wakeWordsDirty ? 'primary' : 'secondary'}
            size="md"
            disabled={busy || parsedWakeWords.length === 0 || !wakeWordsDirty}
            onClick={saveWakeWords}
            className="sm:w-auto shrink-0"
          >
            Guardar
          </Button>
        </div>

        {savedWakeWords.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
            <span className="text-[11px] text-secondary">En uso:</span>
            {savedWakeWords.map((word) => (
              <span
                key={word}
                className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-accent/[0.08] text-accent border border-accent/20"
              >
                {word}
              </span>
            ))}
          </div>
        )}
      </Field>
    </Card>
  );
}

function Field({ label, htmlFor, hint, action, children }: {
  label: string;
  htmlFor: string;
  hint: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={htmlFor} className="text-sm font-medium text-gray-900 dark:text-white">
          {label}
        </label>
        {action}
      </div>
      <p className="text-xs text-secondary -mt-1">{hint}</p>
      {children}
    </div>
  );
}

function MicIcon({ className }: { className: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z" />
    </svg>
  );
}
