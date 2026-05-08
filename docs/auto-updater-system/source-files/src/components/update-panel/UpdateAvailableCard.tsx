interface UpdateAvailableCardProps {
  state: string
  availableVersion?: string | null
  notes?: string | null
  progress: number
  onDownload: () => void
  onInstall: () => void
}

export function UpdateAvailableCard(props: UpdateAvailableCardProps) {
  const { state, availableVersion, notes, progress, onDownload, onInstall } = props
  if (!availableVersion || !['available', 'downloading', 'downloaded'].includes(state)) return null

  return (
    <div className="p-4 rounded-2xl bg-accent/5 border border-accent/15 space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-accent/15 flex items-center justify-center">
          <svg className="w-5 h-5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
          </svg>
        </div>
        <div>
          <p className="text-sm font-bold text-white">SofLIA Hub v{availableVersion}</p>
          <p className="text-[10px] text-gray-500 mt-0.5">Nueva versiÃ³n disponible para descargar</p>
        </div>
      </div>

      {notes && <ReleaseNotes notes={notes} />}
      {state === 'downloading' && <DownloadProgress progress={progress} />}
      {state === 'available' && <UpdateButton onClick={onDownload} label="Descargar actualizaciÃ³n" className="bg-accent" />}
      {state === 'downloaded' && <UpdateButton onClick={onInstall} label="Reiniciar para actualizar" className="bg-emerald-500 shadow-lg shadow-emerald-500/20" />}
    </div>
  )
}

function ReleaseNotes({ notes }: { notes: string }) {
  return (
    <div className="p-3 rounded-xl bg-black/30 border border-white/5 max-h-48 overflow-y-auto custom-scrollbar">
      <p className="text-[10px] text-accent font-bold uppercase tracking-widest mb-3">Novedades</p>
      <div className="text-xs release-notes" dangerouslySetInnerHTML={{ __html: notes }} />
    </div>
  )
}

function DownloadProgress({ progress }: { progress: number }) {
  return (
    <div>
      <div className="flex items-center justify-between text-[10px] font-medium mb-2">
        <span className="text-gray-500">Descargando actualizaciÃ³n</span>
        <span className="text-accent font-bold">{progress}%</span>
      </div>
      <div className="h-2 bg-white/5 rounded-full overflow-hidden">
        <div className="h-full bg-accent rounded-full transition-all duration-500 ease-out shadow-[0_0_10px_rgba(0,186,255,0.4)]" style={{ width: `${progress}%` }} />
      </div>
    </div>
  )
}

function UpdateButton({ onClick, label, className }: { onClick: () => void; label: string; className: string }) {
  return (
    <button onClick={onClick} className={`w-full py-3 rounded-xl text-white text-sm font-bold transition-all hover:scale-[1.01] active:scale-[0.99] ${className}`}>
      {label}
    </button>
  )
}
