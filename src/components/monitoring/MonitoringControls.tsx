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
}

export function MonitoringControls({ userId }: MonitoringControlsProps) {
  const [status, setStatus] = useState<MonitoringStatus | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [currentWindow, setCurrentWindow] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<Date | null>(null);

  // Poll status on mount
  useEffect(() => {
    getMonitoringStatus().then(s => {
      setStatus(s);
      if (s.isRunning && s.sessionId) {
        setSessionId(s.sessionId);
        startTimeRef.current = new Date(Date.now() - (s.snapshotCount || 0) * 30 * 1000);
        startTimer();
      }
    }).catch(() => {});
  }, []);

  // Listen for snapshots
  useEffect(() => {
    if (typeof window.monitoring === 'undefined') return;

    window.monitoring.onSnapshot((snap: ActivitySnapshot) => {
      setCurrentWindow(snap.windowTitle || '');
    });

    window.monitoring.onFlush((data: any) => {
      if (data.snapshots && data.userId && data.sessionId) {
        persistSnapshots(data.userId, data.sessionId, data.snapshots).catch(console.error);
      }
    });

    window.monitoring.onSessionEnded((data: any) => {
      if (data.pendingSnapshots?.length && data.userId && data.sessionId) {
        persistSnapshots(data.userId, data.sessionId, data.pendingSnapshots).catch(console.error);
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
      setSessionId(null);
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
    <div className="bg-white dark:bg-white/5 rounded-xl border border-gray-200 dark:border-white/10 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Monitoreo</h3>
        <div className={`flex items-center gap-1.5 text-xs font-medium ${isRunning ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400 dark:text-gray-500'}`}>
          <span className={`w-2 h-2 rounded-full ${isRunning ? 'bg-emerald-500 animate-pulse' : 'bg-gray-300 dark:bg-gray-600'}`} />
          {isRunning ? 'Activo' : 'Inactivo'}
        </div>
      </div>

      {/* Timer */}
      <div className="text-center mb-4">
        <div className={`text-4xl font-mono font-bold ${isRunning ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-300 dark:text-gray-600'}`}>
          {formatTime(elapsedSeconds)}
        </div>
        {currentWindow && isRunning && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 truncate max-w-[280px] mx-auto">
            {currentWindow}
          </p>
        )}
      </div>

      {/* Controls */}
      <div className="flex gap-2">
        {!isRunning ? (
          <button
            onClick={handleStart}
            disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium transition-colors disabled:opacity-50"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
            </svg>
            {loading ? 'Iniciando...' : 'Iniciar'}
          </button>
        ) : (
          <button
            onClick={handleStop}
            disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition-colors disabled:opacity-50"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clipRule="evenodd" />
            </svg>
            {loading ? 'Deteniendo...' : 'Detener'}
          </button>
        )}
      </div>

      {error && (
        <p className="text-xs text-red-500 mt-2 text-center">{error}</p>
      )}

      {isRunning && status?.snapshotCount != null && (
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-3 text-center">
          {status.snapshotCount} capturas registradas
        </p>
      )}
    </div>
  );
}
