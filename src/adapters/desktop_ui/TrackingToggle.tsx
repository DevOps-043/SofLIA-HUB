import React, { useState, useEffect, useRef } from 'react';
import {
  startMonitoringSession,
  stopMonitoringSession,
  getMonitoringStatus,
  persistSnapshots,
} from '../../services/monitoring-service';
import type { MonitoringSession, ActivitySnapshot } from '../../core/entities/ActivityLog';

interface TrackingToggleProps {
  userId: string;
}

export const TrackingToggle: React.FC<TrackingToggleProps> = ({ userId }) => {
  const [isTracking, setIsTracking] = useState(false);
  const [session, setSession] = useState<MonitoringSession | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [currentWindow, setCurrentWindow] = useState<string>('');
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Check if already tracking on mount
  useEffect(() => {
    getMonitoringStatus().then((status) => {
      if (status.isRunning) {
        setIsTracking(true);
        setCurrentWindow(status.currentWindow || '');
      }
    }).catch(() => {});
  }, []);

  // Timer for elapsed display
  useEffect(() => {
    if (isTracking) {
      timerRef.current = setInterval(() => {
        setElapsed((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      setElapsed(0);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isTracking]);

  // Listen for snapshots to update current window and persist data
  useEffect(() => {
    if (!window.monitoring) return;

    const handleSnapshot = (snapshot: ActivitySnapshot) => {
      setCurrentWindow(snapshot.processName + ': ' + snapshot.windowTitle.slice(0, 40));
    };

    const handleFlush = (data: { userId: string; sessionId: string; snapshots: ActivitySnapshot[] }) => {
      persistSnapshots(data.userId, data.sessionId, data.snapshots);
    };

    const handleSessionEnded = (data: { userId: string; sessionId: string; pendingSnapshots: ActivitySnapshot[] }) => {
      if (data.pendingSnapshots?.length > 0) {
        persistSnapshots(data.userId, data.sessionId, data.pendingSnapshots);
      }
    };

    window.monitoring.onSnapshot(handleSnapshot);
    window.monitoring.onFlush(handleFlush);
    window.monitoring.onSessionEnded(handleSessionEnded);

    return () => {
      window.monitoring.removeListeners();
    };
  }, []);

  const formatTime = (seconds: number): string => {
    const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
    const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
  };

  const handleToggle = async () => {
    if (isTracking && session) {
      await stopMonitoringSession(session.id, userId);
      setIsTracking(false);
      setSession(null);
      setCurrentWindow('');
    } else {
      try {
        const newSession = await startMonitoringSession(userId, 'manual');
        setSession(newSession);
        setIsTracking(true);
      } catch (err: any) {
        console.error('Failed to start monitoring:', err.message);
      }
    }
  };

  return (
    <div className="p-6 flex flex-col items-center gap-6">
      <h2 className="text-2xl font-semibold text-primary dark:text-white">Focus Session</h2>
      <div className="flex flex-col items-center gap-2">
        <div className={`w-16 h-16 rounded-full flex items-center justify-center transition-colors ${isTracking ? 'bg-accent/20' : 'bg-gray-100 dark:bg-white/5'}`}>
          <div className={`w-8 h-8 rounded-full ${isTracking ? 'bg-accent animate-pulse' : 'bg-gray-400'}`}></div>
        </div>
        <span className="text-sm font-medium text-secondary">
          {isTracking ? 'Tracking Active' : 'Ready to Start'}
        </span>
      </div>

      <div className="text-center">
        <div className="text-4xl font-mono font-bold text-primary dark:text-white tracking-wider">
          {formatTime(elapsed)}
        </div>
        <div className="text-xs text-secondary mt-1">SESSION DURATION</div>
      </div>

      {isTracking && currentWindow && (
        <div className="text-xs text-secondary text-center truncate max-w-full px-4">
          {currentWindow}
        </div>
      )}

      <button
        onClick={handleToggle}
        className={`w-full py-3 px-6 rounded-xl font-semibold transition-all shadow-lg hover:shadow-xl active:scale-95 ${
          isTracking
            ? 'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400'
            : 'bg-primary text-white hover:bg-primary/90'
        }`}
      >
        {isTracking ? 'Stop Session' : 'Start Focus Session'}
      </button>
    </div>
  );
};
