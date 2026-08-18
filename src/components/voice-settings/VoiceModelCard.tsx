import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { SectionHeader } from '../ui/SectionHeader';
import type { VoicePassivePanel } from './useVoicePassivePanel';

/**
 * Descarga del modelo de reconocimiento. Se muestra en dos momentos distintos:
 * sin modelo (bloqueante) y con el pequeño instalado (mejora opcional).
 */
export function VoiceModelCard({ panel }: { panel: VoicePassivePanel }) {
  const { status, modelInstalled, downloadProgress, busy, installModel } = panel;
  const largeInstalled = Boolean(status?.largeModelInstalled);

  if (modelInstalled && largeInstalled) return null;

  const upgrading = modelInstalled && !largeInstalled;

  return (
    <Card className="space-y-4">
      <SectionHeader
        title={upgrading ? 'Mejorar la precisión' : 'Modelo de reconocimiento'}
        subtitle={upgrading
          ? 'Opcional: modelo grande de español para habla natural.'
          : 'Necesario para detectar la palabra de activación.'}
        icon={<DownloadIcon className="w-4.5 h-4.5" />}
      />

      <p className="text-xs leading-relaxed text-secondary">
        {upgrading
          ? 'Si SofLIA confunde palabras, instala el modelo grande (~1.4 GB de descarga, ~2 GB de RAM). Se activa automáticamente para el dictado y mantiene el pequeño para la wake word.'
          : 'El modelo de español (licencia Apache-2.0) se descarga una sola vez y se guarda en tu equipo. Ocupa unos 39 MB.'}
      </p>

      {downloadProgress !== null ? (
        <DownloadProgress
          percent={downloadProgress}
          label={upgrading ? 'Descargando modelo grande' : 'Descargando modelo'}
        />
      ) : (
        <Button
          variant={upgrading ? 'secondary' : 'primary'}
          size="md"
          disabled={busy || !status?.runtimeAvailable}
          onClick={() => installModel(upgrading ? 'large' : 'small')}
        >
          {upgrading ? 'Descargar modelo grande (~1.4 GB)' : 'Descargar modelo de voz (~39 MB)'}
        </Button>
      )}

      {!status?.runtimeAvailable && (
        <p className="text-xs text-secondary">
          La descarga se habilita cuando el runtime de Python esté instalado.
        </p>
      )}
    </Card>
  );
}

function DownloadProgress({ percent, label }: { percent: number; label: string }) {
  return (
    <div className="space-y-2">
      <div
        className="h-1.5 rounded-full bg-surface-2 overflow-hidden"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
      >
        <div
          className="h-full rounded-full bg-accent transition-[width] duration-300"
          style={{ width: `${percent}%` }}
        />
      </div>
      <p className="text-xs text-secondary tabular-nums">{label}… {percent}%</p>
    </div>
  );
}

function DownloadIcon({ className }: { className: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v12m0 0 4-4m-4 4-4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
    </svg>
  );
}
