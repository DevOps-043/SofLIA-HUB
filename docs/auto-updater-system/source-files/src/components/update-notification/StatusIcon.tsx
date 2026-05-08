import type { UpdatePhase } from './types'

export function StatusIcon({ phase }: { phase: UpdatePhase }) {
  const iconClass = phase === 'ready'
    ? 'bg-emerald-500/15'
    : phase === 'error'
      ? 'bg-red-500/15'
      : 'bg-accent/15'

  return (
    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${iconClass}`}>
      {phase === 'ready' ? (
        <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
        </svg>
      ) : phase === 'error' ? (
        <svg className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01" />
        </svg>
      ) : (
        <svg className="w-4 h-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
      )}
    </div>
  )
}
