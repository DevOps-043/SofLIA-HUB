import type { MonitoringStatus } from '../../../core/entities/ActivityLog';

interface MonitoringNoticesProps {
  isRunning: boolean;
  calendarEventTitle?: string | null;
  calendarAutoSessionId?: string | null;
  error: string | null;
  persistError: string | null;
  status: MonitoringStatus | null;
}

export function MonitoringNotices({ isRunning, calendarEventTitle, calendarAutoSessionId, error, persistError, status }: MonitoringNoticesProps) {
  return (
    <>
      {isRunning && calendarEventTitle && calendarAutoSessionId && (
        <div className="mt-4 flex items-center gap-2 px-3 py-2 bg-blue-500/5 border border-blue-500/10 rounded-xl">
          <svg className="w-3.5 h-3.5 text-blue-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <p className="text-[10px] text-blue-400 font-bold truncate">Auto: {calendarEventTitle}</p>
        </div>
      )}

      {(error || persistError) && (
        <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl animate-bounce">
          <p className="text-[10px] text-red-500 font-bold text-center">{error || persistError}</p>
        </div>
      )}

      {(status?.diagnostics?.activeWinFailCount || 0) > 0 && (
        <div className="mt-4 flex items-center gap-2 px-3 py-2 bg-amber-500/5 border border-amber-500/10 rounded-xl">
          <svg className="w-3.5 h-3.5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span className="text-[10px] text-amber-500/70 font-medium">Interferencia en detección de ventana</span>
        </div>
      )}
    </>
  );
}
