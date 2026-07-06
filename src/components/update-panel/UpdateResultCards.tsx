import type { UpdaterStatus } from '../../services/updater-service';

interface UpdateResultCardsProps {
  state: string;
  checking: boolean;
  currentVersion: string;
  error: string | null;
  status: UpdaterStatus | null;
}

export function UpdateResultCards({ state, checking, currentVersion, error, status }: UpdateResultCardsProps) {
  return (
    <>
      {state === 'not-available' && !checking && (
        <div className="p-3.5 rounded-xl bg-success/5 border border-success/15 flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-success/10 flex items-center justify-center shrink-0">
            <svg className="w-4 h-4 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-900 dark:text-white">Estás al día</p>
            <p className="text-[10px] text-secondary">SofLIA Hub v{currentVersion} es la versión más reciente.</p>
          </div>
        </div>
      )}

      {(state === 'error' || error) && (
        <div className="p-3.5 rounded-xl bg-danger/5 border border-danger/15 flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-danger/10 flex items-center justify-center shrink-0">
            <svg className="w-4 h-4 text-danger" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-gray-900 dark:text-white">Error al verificar</p>
            <p className="text-[10px] text-danger/80 truncate">{error || status?.error || 'No se pudo conectar al servidor'}</p>
          </div>
        </div>
      )}
    </>
  );
}
