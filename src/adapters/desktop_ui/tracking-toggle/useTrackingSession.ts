import { useEffect, useRef, useState } from 'react';
import type { ActivitySnapshot, MonitoringSession } from '../../../core/entities/ActivityLog';
import {
  getMonitoringStatus,
  persistSnapshots,
  startMonitoringSession,
  stopMonitoringSession,
} from '../../../services/monitoring-service';

export function useTrackingSession(userId: string) {
  const [isTracking, setIsTracking] = useState(false);
  const [session, setSession] = useState<MonitoringSession | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [currentWindow, setCurrentWindow] = useState('');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    getMonitoringStatus().then((status) => {
      if (!status.isRunning) return;
      setIsTracking(true);
      setCurrentWindow(status.currentWindow || '');
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!isTracking) {
      clearTrackingTimer(timerRef.current);
      timerRef.current = null;
      setElapsed(0);
      return;
    }

    timerRef.current = setInterval(() => setElapsed((prev) => prev + 1), 1000);
    return () => clearTrackingTimer(timerRef.current);
  }, [isTracking]);

  useEffect(() => {
    if (!window.monitoring) return;

    window.monitoring.onSnapshot((snapshot: ActivitySnapshot) => {
      setCurrentWindow(`${snapshot.processName}: ${snapshot.windowTitle.slice(0, 40)}`);
    });
    window.monitoring.onFlush((data) => {
      persistSnapshots(data.userId, data.sessionId, data.snapshots);
    });
    window.monitoring.onSessionEnded((data) => {
      if (data.pendingSnapshots?.length > 0) {
        persistSnapshots(data.userId, data.sessionId, data.pendingSnapshots);
      }
    });

    return () => window.monitoring.removeListeners();
  }, []);

  const handleToggle = async () => {
    if (isTracking && session) {
      await stopMonitoringSession(session.id, userId);
      setIsTracking(false);
      setSession(null);
      setCurrentWindow('');
      return;
    }

    try {
      const newSession = await startMonitoringSession(userId, 'manual');
      setSession(newSession);
      setIsTracking(true);
    } catch (err: any) {
      console.error('Failed to start monitoring:', err.message);
    }
  };

  return { isTracking, elapsed, currentWindow, handleToggle };
}

function clearTrackingTimer(timer: ReturnType<typeof setInterval> | null) {
  if (timer) clearInterval(timer);
}
