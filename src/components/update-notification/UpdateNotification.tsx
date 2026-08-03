import { NotificationActions } from './NotificationActions';
import { ProgressBar } from './ProgressBar';
import { ReleaseNotesToggle } from './ReleaseNotesToggle';
import { StatusIcon } from './StatusIcon';
import { useUpdateNotification } from './useUpdateNotification';

function getTitle(phase: string): string {
  if (phase === 'ready') return 'Lista para instalar';
  if (phase === 'downloading') return 'Descargando...';
  if (phase === 'error') return 'Error de actualizacion';
  return 'Nueva version disponible';
}

export function UpdateNotification() {
  const { state, handleDownload, handleDismiss, handleInstall, retry, toggleNotes } = useUpdateNotification();
  if (state.phase === 'hidden' || state.dismissed) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[9999] max-w-sm animate-in slide-in-from-bottom-4 fade-in duration-500">
      <div className="relative overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl shadow-black/30">
        {state.phase === 'downloading' && (
          <div className="h-0.5 bg-surface-2">
            <div className="h-full bg-accent transition-all duration-500 ease-out" style={{ width: `${state.progress}%` }} />
          </div>
        )}
        <div className="p-4">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-center gap-2.5">
              <StatusIcon phase={state.phase} />
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">{getTitle(state.phase)}</p>
                <p className="text-xs text-secondary mt-0.5">
                  {state.phase === 'error' ? state.error : `Pulse Hub v${state.version}`}
                </p>
              </div>
            </div>
            <button onClick={handleDismiss} className="text-secondary hover:text-gray-900 dark:hover:text-white transition-colors p-0.5">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          {state.phase === 'downloading' && <ProgressBar progress={state.progress} />}
          {state.releaseNotes && state.phase === 'available' && (
            <ReleaseNotesToggle releaseNotes={state.releaseNotes} showNotes={state.showNotes} onToggle={toggleNotes} />
          )}
          <div className="flex gap-2">
            <NotificationActions
              phase={state.phase}
              onDownload={handleDownload}
              onDismiss={handleDismiss}
              onInstall={handleInstall}
              onRetry={retry}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
