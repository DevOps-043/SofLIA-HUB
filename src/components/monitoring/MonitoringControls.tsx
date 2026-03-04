import { useState, useEffect, useRef, useCallback } from 'react';
import {
  startMonitoringSession,
  stopMonitoringSession,
  getMonitoringStatus,
  persistSnapshots,
} from '../../services/monitoring-service';
import type { MonitoringStatus, ActivitySnapshot } from '../../core/entities/ActivityLog';

interface MonitoringControlsProps {
  userId: string;
  calendarAutoSessionId?: string | null;
  calendarEventTitle?: string | null;
  onManualStop?: () => void;
  onDataFlushed?: () => void;
}

export function MonitoringControls({ userId, calendarAutoSessionId, calendarEventTitle, onManualStop, onDataFlushed }: MonitoringControlsProps) {
  const [status, setStatus] = useState<MonitoringStatus | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [currentWindow, setCurrentWindow] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [persistError, setPersistError] = useState<string | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<Date | null>(null);
  // Refs to avoid stale closures in the IPC event useEffect
  const onDataFlushedRef = useRef(onDataFlushed);
  const sessionIdRef = useRef<string | null>(null);
  const userIdRef = useRef(userId);
  useEffect(() => { onDataFlushedRef.current = onDataFlushed; }, [onDataFlushed]);
  useEffect(() => { userIdRef.current = userId; }, [userId]);

  // Poll status on mount
  useEffect(() => {
    getMonitoringStatus().then(s => {
      setStatus(s);
      if (s.isRunning && s.sessionId) {
        setSessionId(s.sessionId);
        sessionIdRef.current = s.sessionId;
        startTimeRef.current = new Date(Date.now() - (s.snapshotCount || 0) * 30 * 1000);
        startTimer();
      }
    }).catch(() => {});
  }, []);

  // Sync state when calendar auto-session starts
  useEffect(() => {
    if (calendarAutoSessionId && !sessionId) {
      setSessionId(calendarAutoSessionId);
      sessionIdRef.current = calendarAutoSessionId;
      startTimeRef.current = new Date();
      setElapsedSeconds(0);
      startTimer();
      setStatus({ isRunning: true, userId, sessionId: calendarAutoSessionId, snapshotCount: 0, config: { intervalSeconds: 30, idleThresholdSeconds: 120, screenshotEnabled: true, ocrEnabled: false } });
    }
    if (!calendarAutoSessionId && sessionId && status?.isRunning) {
      // Calendar auto-session ended externally
      setSessionId(null);
      sessionIdRef.current = null;
      startTimeRef.current = null;
      if (timerRef.current) clearInterval(timerRef.current);
      setElapsedSeconds(0);
      setCurrentWindow('');
      setStatus(prev => prev ? { ...prev, isRunning: false, snapshotCount: 0 } : null);
    }
  }, [calendarAutoSessionId]);

  // Listen for snapshots
  useEffect(() => {
    if (typeof window.monitoring === 'undefined') return;

    // Persist each snapshot immediately — this is the PRIMARY persist path.
    // We know onSnapshot works (counter updates), so we persist here instead
    // of relying on the flush event pipeline which has proven unreliable.
    window.monitoring.onSnapshot((snap: ActivitySnapshot) => {
      setCurrentWindow(snap.windowTitle || '');
      setStatus(prev => prev ? { ...prev, snapshotCount: (prev.snapshotCount || 0) + 1 } : prev);

      const sid = sessionIdRef.current;
      const uid = userIdRef.current;
      if (sid && uid) {
        persistSnapshots(uid, sid, [snap])
          .then(() => {
            setPersistError(null);
            onDataFlushedRef.current?.();
          })
          .catch((err: any) => {
            console.error('[MonitoringControls] Snapshot persist failed:', err);
            setPersistError(`Error guardando: ${err.message}`);
          });
      }
    });

    // Flush is now a backup — primary persist happens in onSnapshot above
    window.monitoring.onFlush(() => {
      // Data already persisted per-snapshot, just trigger a reload
      onDataFlushedRef.current?.();
    });

    window.monitoring.onSessionEnded((data: any) => {
      // Persist any remaining snapshots that might have been missed
      if (data.pendingSnapshots?.length && data.userId && data.sessionId) {
        persistSnapshots(data.userId, data.sessionId, data.pendingSnapshots)
          .then(() => onDataFlushedRef.current?.())
          .catch(console.error);
      }
    });

    window.monitoring.onError((err: any) => {
      console.error('[MonitoringControls] Error:', err.message);
    });

    return () => {
      window.monitoring.removeListeners();
    };
  }, []);

  const startTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      if (startTimeRef.current) {
        setElapsedSeconds(Math.floor((Date.now() - startTimeRef.current.getTime()) / 1000));
      }
    }, 1000);
  }, []);

  const handleStart = async () => {
    setLoading(true);
    setError(null);
    try {
      const session = await startMonitoringSession(userId, 'manual');
      setSessionId(session.id);
      sessionIdRef.current = session.id;
      startTimeRef.current = new Date();
      setElapsedSeconds(0);
      startTimer();
      setStatus({ isRunning: true, userId, sessionId: session.id, snapshotCount: 0, config: { intervalSeconds: 30, idleThresholdSeconds: 120, screenshotEnabled: true, ocrEnabled: false } });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleStop = async () => {
    if (!sessionId) return;
    setLoading(true);
    setError(null);
    try {
      await stopMonitoringSession(sessionId, userId);
      if (calendarAutoSessionId) {
        onManualStop?.();
      }
      setSessionId(null);
      sessionIdRef.current = null;
      startTimeRef.current = null;
      if (timerRef.current) clearInterval(timerRef.current);
      setElapsedSeconds(0);
      setCurrentWindow('');
      setStatus({ isRunning: false, snapshotCount: 0, sessionId: null, userId: null, config: { intervalSeconds: 30, idleThresholdSeconds: 120, screenshotEnabled: true, ocrEnabled: false } });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (seconds: number): string => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const isRunning = status?.isRunning || false;

  return (
    <div className="relative group/monitor">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-sm font-bold text-white tracking-tight">Estado de Monitoreo</h3>
          <p className="text-[10px] text-gray-500 uppercase tracking-widest mt-0.5">Control en tiempo real</p>
        </div>
        <div className={`flex items-center gap-2 px-3 py-1 rounded-full border transition-all duration-500 ${
          isRunning 
            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.1)]' 
            : 'bg-white/5 border-white/10 text-gray-500'
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full ${isRunning ? 'bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]' : 'bg-gray-600'}`} />
          <span className="text-[10px] font-bold uppercase tracking-wider">{isRunning ? 'En Vivo' : 'Pausado'}</span>
        </div>
      </div>

      {/* Futuristic Timer */}
      <div className="relative py-8 mb-8 flex flex-col items-center justify-center">
        <div className="absolute inset-0 bg-accent/5 rounded-full blur-3xl opacity-0 group-hover/monitor:opacity-100 transition-opacity duration-1000"></div>
        <div className={`text-5xl font-black tracking-tighter transition-all duration-700 ${
          isRunning ? 'text-white scale-110 drop-shadow-[0_0_10px_rgba(255,255,255,0.2)]' : 'text-white/20'
        }`}>
          {formatTime(elapsedSeconds)}
        </div>
        
        {currentWindow && isRunning && (
          <div className="mt-4 px-4 py-2 bg-white/5 border border-white/10 rounded-xl backdrop-blur-md max-w-full animate-in fade-in slide-in-from-top-2 duration-500">
            <p className="text-[10px] text-accent font-bold uppercase tracking-widest text-center mb-1">Ventana Activa</p>
            <p className="text-xs text-gray-300 truncate text-center font-medium italic">
              "{currentWindow}"
            </p>
          </div>
        )}
      </div>

      {/* High-End Controls */}
      <div className="flex flex-col gap-3">
        {!isRunning ? (
          <button
            onClick={handleStart}
            disabled={loading}
            className="w-full relative group/btn overflow-hidden py-4 rounded-2xl bg-white text-black text-sm font-black transition-all hover:scale-[1.02] active:scale-[0.98] shadow-xl hover:shadow-white/10"
          >
            <div className="absolute inset-0 bg-accent translate-y-full group-hover/btn:translate-y-0 transition-transform duration-500"></div>
            <span className="relative z-10 flex items-center justify-center gap-2 group-hover/btn:text-white transition-colors duration-300">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
              </svg>
              {loading ? 'Sincronizando...' : 'Iniciar Monitoreo'}
            </span>
          </button>
        ) : (
          <button
            onClick={handleStop}
            disabled={loading}
            className="w-full relative group/btn overflow-hidden py-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 text-sm font-black transition-all hover:bg-red-500 hover:text-white hover:border-transparent active:scale-[0.98] shadow-lg hover:shadow-red-500/20"
          >
            <span className="relative z-10 flex items-center justify-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clipRule="evenodd" />
              </svg>
              {loading ? 'Guardando Sesión...' : 'Detener y Guardar'}
            </span>
          </button>
        )}
        
        {/* Status Bar */}
        {isRunning && (
          <div className="mt-4 p-4 rounded-2xl bg-white/5 border border-white/10">
            <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">
              <span>Sincronización</span>
              <span className="text-accent">{status?.snapshotCount || 0} capturas</span>
            </div>
            <div className="h-1 bg-white/5 rounded-full overflow-hidden">
              <div 
                className="h-full bg-accent transition-all duration-1000 shadow-[0_0_8px_rgba(0,186,255,0.5)]" 
                style={{ width: `${Math.min(((status?.snapshotCount || 0) % 60) / 0.6, 100)}%` }}
              ></div>
            </div>
          </div>
        )}
      </div>

      {/* Context info for Calendar Auto */}
      {isRunning && calendarEventTitle && calendarAutoSessionId && (
        <div className="mt-4 flex items-center gap-2 px-3 py-2 bg-blue-500/5 border border-blue-500/10 rounded-xl">
          <svg className="w-3.5 h-3.5 text-blue-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <p className="text-[10px] text-blue-400 font-bold truncate">
            Auto: {calendarEventTitle}
          </p>
        </div>
      )}

      {/* Errors */}
      {(error || persistError) && (
        <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl animate-bounce">
          <p className="text-[10px] text-red-500 font-bold text-center">
            {error || persistError}
          </p>
        </div>
      )}

      {/* Diagnósticos sutiles */}
      {(status?.diagnostics?.activeWinFailCount || 0) > 0 && (
        <div className="mt-4 flex items-center gap-2 px-3 py-2 bg-amber-500/5 border border-amber-500/10 rounded-xl">
           <svg className="w-3.5 h-3.5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span className="text-[10px] text-amber-500/70 font-medium">Interferencia en detección de ventana</span>
        </div>
      )}
    </div>
  );
}
