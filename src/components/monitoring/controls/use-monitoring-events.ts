import { useEffect } from 'react';
import type { MutableRefObject } from 'react';
import type { ActivitySnapshot } from '../../../core/entities/ActivityLog';
import { persistSnapshots } from '../../../services/monitoring-service';

interface MonitoringEventsOptions {
  sessionIdRef: MutableRefObject<string | null>;
  userIdRef: MutableRefObject<string>;
  onDataFlushedRef: MutableRefObject<(() => void) | undefined>;
  setCurrentWindow: (value: string) => void;
  incrementSnapshotCount: () => void;
  setPersistError: (value: string | null) => void;
}

export function useMonitoringEvents({
  sessionIdRef,
  userIdRef,
  onDataFlushedRef,
  setCurrentWindow,
  incrementSnapshotCount,
  setPersistError,
}: MonitoringEventsOptions) {
  useEffect(() => {
    if (typeof window.monitoring === 'undefined') return;

    window.monitoring.onSnapshot((snap: ActivitySnapshot) => {
      setCurrentWindow(snap.windowTitle || '');
      incrementSnapshotCount();

      const sid = sessionIdRef.current;
      const uid = userIdRef.current;
      if (!sid || !uid) return;

      persistSnapshots(uid, sid, [snap])
        .then(() => {
          setPersistError(null);
          onDataFlushedRef.current?.();
        })
        .catch((err: any) => {
          console.error('[MonitoringControls] Snapshot persist failed:', err);
          setPersistError(`Error guardando: ${err.message}`);
        });
    });

    window.monitoring.onFlush(() => onDataFlushedRef.current?.());

    window.monitoring.onSessionEnded((data: any) => {
      if (!data.pendingSnapshots?.length || !data.userId || !data.sessionId) return;
      persistSnapshots(data.userId, data.sessionId, data.pendingSnapshots)
        .then(() => onDataFlushedRef.current?.())
        .catch(console.error);
    });

    window.monitoring.onError((err: any) => {
      console.error('[MonitoringControls] Error:', err.message);
    });

    return () => window.monitoring.removeListeners();
  }, []);
}
