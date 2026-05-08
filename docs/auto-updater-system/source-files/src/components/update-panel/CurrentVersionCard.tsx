import type { UpdaterStatus } from '../../services/updater-service'

type CurrentVersionCardProps = {
  currentVersion: string
  state: UpdaterStatus['state'] | 'idle'
  checking: boolean
}

function statusLabel(state: CurrentVersionCardProps['state'], checking: boolean) {
  if (state === 'available') return 'ActualizaciÃ³n disponible'
  if (state === 'downloading') return 'Descargando...'
  if (state === 'downloaded') return 'Lista para instalar'
  if (state === 'checking' || checking) return 'Verificando...'
  if (state === 'error') return 'Error'
  return 'Al dÃ­a'
}

function statusClass(state: CurrentVersionCardProps['state']) {
  if (state === 'available' || state === 'downloading' || state === 'downloaded') {
    return 'bg-accent/10 border border-accent/20 text-accent'
  }
  if (state === 'error') return 'bg-red-500/10 border border-red-500/20 text-red-400'
  return 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
}

export function CurrentVersionCard({ currentVersion, state, checking }: CurrentVersionCardProps) {
  return (
    <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">VersiÃ³n actual</p>
          <p className="text-2xl font-black text-white mt-1">v{currentVersion}</p>
        </div>
        <div className={`px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${statusClass(state)}`}>
          {statusLabel(state, checking)}
        </div>
      </div>
    </div>
  )
}
