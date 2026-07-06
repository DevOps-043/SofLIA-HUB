import { SafeReleaseNotes } from '../update-notes/SafeReleaseNotes';

type Props = {
  availableVersion?: string | null;
  notes?: string | null;
  progress: number;
  state: string;
  onDownload: () => void;
  onInstall: () => void;
};

export function AvailableUpdateCard({ availableVersion, notes, progress, state, onDownload, onInstall }: Props) {
  if (!availableVersion || !['available', 'downloading', 'downloaded'].includes(state)) {
    return null;
  }

  return (
    <div className="p-4 rounded-2xl bg-accent/5 border border-accent/15 space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-accent/15 flex items-center justify-center">
          <svg className="w-5 h-5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
          </svg>
        </div>
        <div>
          <p className="text-sm font-bold text-gray-900 dark:text-white">SofLIA Hub v{availableVersion}</p>
          <p className="text-[10px] text-gray-500 mt-0.5">Nueva version disponible para descargar</p>
        </div>
      </div>

      {notes && (
        <div className="p-3 rounded-xl bg-gray-100 dark:bg-black/30 border border-gray-200 dark:border-white/5 max-h-48 overflow-y-auto custom-scrollbar">
          <p className="text-[10px] text-accent font-bold uppercase tracking-widest mb-3">Novedades</p>
          <SafeReleaseNotes notes={notes} className="text-xs release-notes" />
        </div>
      )}

      {state === 'downloading' && <DownloadProgress progress={progress} />}
      {state === 'available' && <UpdateActionButton label="Descargar actualizacion" onClick={onDownload} tone="accent" />}
      {state === 'downloaded' && <UpdateActionButton label="Reiniciar para actualizar" onClick={onInstall} tone="success" />}
    </div>
  );
}

function DownloadProgress({ progress }: { progress: number }) {
  return (
    <div>
      <div className="flex items-center justify-between text-[10px] font-medium mb-2">
        <span className="text-gray-500">Descargando actualizacion</span>
        <span className="text-accent font-bold">{progress}%</span>
      </div>
      <div className="h-2 bg-gray-200 dark:bg-white/5 rounded-full overflow-hidden">
        <div
          className="h-full bg-accent rounded-full transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

function UpdateActionButton({ label, onClick, tone }: { label: string; onClick: () => void; tone: 'accent' | 'success' }) {
  const className = tone === 'accent'
    ? 'w-full py-3 rounded-xl bg-accent text-white text-sm font-bold transition-all hover:scale-[1.01] active:scale-[0.99]'
    : 'w-full py-3 rounded-xl bg-emerald-500 text-white text-sm font-bold transition-all hover:scale-[1.01] active:scale-[0.99] shadow-lg shadow-emerald-500/20';

  return (
    <button onClick={onClick} className={className}>
      {label}
    </button>
  );
}
