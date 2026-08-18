import { useCallback, useEffect, useRef, useState } from 'react';
import { getMonitoringStatus, startMonitoringSession, stopMonitoringSession } from '../../../services/monitoring-service';
import type { MonitoringStatus } from '../../../core/entities/ActivityLog';
import type { MonitoringControlsProps } from './types';
import { createRunningStatus, createStoppedStatus } from './status-factory';
import { useMonitoringEvents } from './use-monitoring-events';
import { useMonitoringTimer } from './use-monitoring-timer';

export function useMonitoringControlsState({ userId, calendarAutoSessionId, onManualStop, onDataFlushed }: MonitoringControlsProps) {
  const [status, setStatus] = useState<MonitoringStatus | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [currentWindow, setCurrentWindow] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [persistError, setPersistError] = useState<string | null>(null);
  const onDataFlushedRef = useRef(onDataFlushed);
  const sessionIdRef = useRef<string | null>(null);
  const userIdRef = useRef(userId);
  // Sesion adoptada desde el calendario: solo esa se detiene cuando el auto-trigger desaparece.
  const adoptedAutoSessionRef = useRef<string | null>(null);
  const { elapsedSeconds, setElapsedSeconds, startTimeRef, clearTimer, startTimer, resetTimer } = useMonitoringTimer();

  const stopLocalSession = useCallback(() => {
    setSessionId(null);
    sessionIdRef.current = null;
    adoptedAutoSessionRef.current = null;
    resetTimer();
    setCurrentWindow('');
  }, [resetTimer]);

  useEffect(() => { onDataFlushedRef.current = onDataFlushed; }, [onDataFlushed]);
  useEffect(() => { userIdRef.current = userId; }, [userId]);

  useEffect(() => {
    getMonitoringStatus().then(s => {
      // Este fetch es asincrono: si ya se adopto o inicio una sesion local, no la pisamos.
      if (sessionIdRef.current) return;
      setStatus(s);
      if (!s.isRunning || !s.sessionId) return;
      setSessionId(s.sessionId);
      sessionIdRef.current = s.sessionId;
      startTimeRef.current = new Date(Date.now() - (s.snapshotCount || 0) * 30 * 1000);
      startTimer();
    }).catch(() => {});
    return clearTimer;
  }, [clearTimer, startTimeRef, startTimer]);

  useEffect(() => {
    if (calendarAutoSessionId && !sessionId) {
      adoptedAutoSessionRef.current = calendarAutoSessionId;
      setSessionId(calendarAutoSessionId);
      sessionIdRef.current = calendarAutoSessionId;
      startTimeRef.current = new Date();
      setElapsedSeconds(0);
      startTimer();
      setStatus(createRunningStatus(userId, calendarAutoSessionId));
      return;
    }
    // Solo se detiene la sesion que vino del calendario; una sesion manual sobrevive.
    if (!calendarAutoSessionId && sessionId && sessionId === adoptedAutoSessionRef.current) {
      stopLocalSession();
      setStatus(prev => prev ? { ...prev, isRunning: false, snapshotCount: 0 } : null);
    }
  }, [calendarAutoSessionId, sessionId, setElapsedSeconds, startTimeRef, startTimer, stopLocalSession, userId]);

  useMonitoringEvents({
    sessionIdRef,
    userIdRef,
    onDataFlushedRef,
    setCurrentWindow,
    incrementSnapshotCount: () => setStatus(prev => prev ? { ...prev, snapshotCount: (prev.snapshotCount || 0) + 1 } : prev),
    setPersistError,
  });

  const handleStart = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const session = await startMonitoringSession(userId, 'manual');
      setSessionId(session.id);
      sessionIdRef.current = session.id;
      startTimeRef.current = new Date();
      setElapsedSeconds(0);
      startTimer();
      setStatus(createRunningStatus(userId, session.id));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [startTimer, userId]);

  const handleStop = useCallback(async () => {
    if (!sessionId) return;
    setLoading(true);
    setError(null);
    try {
      await stopMonitoringSession(sessionId, userId);
      if (calendarAutoSessionId) onManualStop?.();
      stopLocalSession();
      setStatus(createStoppedStatus());
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [calendarAutoSessionId, onManualStop, sessionId, stopLocalSession, userId]);

  return { status, elapsedSeconds, currentWindow, loading, error, persistError, isRunning: status?.isRunning || false, handleStart, handleStop };
}
