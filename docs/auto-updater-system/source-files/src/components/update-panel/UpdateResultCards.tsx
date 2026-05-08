import type { UpdaterStatus } from '../../services/updater-service'

interface UpdateResultCardsProps {
  state: string
  checking: boolean
  currentVersion: string
  error: string | null
  status: UpdaterStatus | null
}

export function UpdateResultCards({ state, checking, currentVersion, error, status }: UpdateResultCardsProps) {
  return (
    <>
      {state === 'not-available' && !checking && <CurrentCard currentVersion={currentVersion} />}
      {(state === 'error' || error) && <ErrorCard message={error || status?.error} />}
    </>
  )
}

function CurrentCard({ currentVersion }: { currentVersion: string }) {
  return (
    <div className="p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/15 flex items-center gap-3">
      <div className="w-10 h-10 rounded-xl bg-emerald-500/15 flex items-center justify-center">
        <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <div>
        <p className="text-sm font-bold text-white">EstÃ¡s al dÃ­a</p>
        <p className="text-[10px] text-gray-500 mt-0.5">SofLIA Hub v{currentVersion} es la versiÃ³n mÃ¡s reciente</p>
      </div>
    </div>
  )
}

function ErrorCard({ message }: { message?: string | null }) {
  return (
    <div className="p-4 rounded-2xl bg-red-500/5 border border-red-500/15 flex items-center gap-3">
      <div className="w-10 h-10 rounded-xl bg-red-500/15 flex items-center justify-center shrink-0">
        <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      </div>
      <div>
        <p className="text-sm font-bold text-white">Error al verificar</p>
        <p className="text-[10px] text-red-400/70 mt-0.5">{message || 'No se pudo conectar al servidor de actualizaciones'}</p>
      </div>
    </div>
  )
}
