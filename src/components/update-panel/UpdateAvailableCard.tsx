import { SafeReleaseNotes } from '../update-notes/SafeReleaseNotes';

interface UpdateAvailableCardProps {
  state: string;
  availableVersion?: string | null;
  notes?: string | null;
  progress: number;
  onDownload: () => void;
  onInstall: () => void;
}

export function UpdateAvailableCard({ state, availableVersion, notes, progress, onDownload, onInstall }: UpdateAvailableCardProps) {
  if (!availableVersion || !['available', 'downloading', 'downloaded'].includes(state)) return null;

  return (
    <div className="rounded-xl border border-accent/20 bg-gradient-to-br from-accent/[0.04] to-accent/[0.08] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-accent/10">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-accent/15 flex items-center justify-center">
            <svg className="w-3.5 h-3.5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
            </svg>
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-900 dark:text-white">SofLIA Hub v{availableVersion}</p>
            <p className="text-[10px] text-secondary">Nueva versión disponible</p>
          </div>
        </div>

        {state === 'available' && (
          <button
            onClick={onDownload}
            className="px-3.5 py-1.5 rounded-lg bg-accent text-on-accent text-[11px] font-medium transition-all hover:brightness-110 active:scale-[0.97]"
          >
            Descargar
          </button>
        )}
        {state === 'downloaded' && (
          <button
            onClick={onInstall}
            className="px-3.5 py-1.5 rounded-lg bg-success text-white text-[11px] font-medium transition-all hover:brightness-110 active:scale-[0.97]"
          >
            Instalar y reiniciar
          </button>
        )}
      </div>

      {/* Download progress */}
      {state === 'downloading' && (
        <div className="px-4 py-3 border-b border-accent/10">
          <div className="flex items-center justify-between text-[10px] mb-1.5">
            <span className="text-secondary font-medium">Descargando actualización</span>
            <span className="text-accent font-semibold tabular-nums">{Math.round(progress)}%</span>
          </div>
          <div className="h-1.5 bg-accent/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-accent rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Release notes preview */}
      {notes && (
        <div className="px-4 py-3 max-h-36 overflow-y-auto no-scrollbar">
          <p className="text-[10px] text-accent font-medium mb-2 uppercase tracking-wider">Novedades</p>
          <SafeReleaseNotes notes={notes} className="text-[11px] text-secondary leading-relaxed" />
        </div>
      )}
    </div>
  );
}
