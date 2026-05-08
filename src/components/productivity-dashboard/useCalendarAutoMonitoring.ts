import { useCallback, useEffect, useRef, useState } from 'react';
import { getMonitoringStatus, startMonitoringSession, stopMonitoringSession } from '../../services/monitoring-service';

type AutoSessionInfo = { sessionId: string; eventTitle: string } | null;

export function useCalendarAutoMonitoring(userId: string) {
  const [autoSessionInfo, setAutoSessionInfo] = useState<AutoSessionInfo>(null);
  const calendarAutoSessionIdRef = useRef<string | null>(null);
  const calendarAutoEventIdRef = useRef<string | null>(null);
  const manuallyStoppedEventIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (typeof (window as any).calendar === 'undefined') return;
    const calendar = (window as any).calendar;

    calendar.getStatus().then(async (status: any) => {
      if (!status.inWorkHours || !status.currentEvent || !userId) return;
      try {
        if ((await getMonitoringStatus()).isRunning) return;
        await startCalendarSession(userId, status.currentEvent, setAutoSessionInfo, calendarAutoSessionIdRef, calendarAutoEventIdRef);
      } catch (err: any) {
        console.error('[ProductivityDashboard] Calendar auto-start on mount failed:', err.message);
      }
    }).catch(() => {});

    calendar.onWorkStart(async (data: any) => {
      const event = data?.event;
      if (!event || !userId || manuallyStoppedEventIdRef.current === event.id) return;
      try {
        if ((await getMonitoringStatus()).isRunning) return;
      } catch {
        // proceed
      }
      await startCalendarSession(userId, event, setAutoSessionInfo, calendarAutoSessionIdRef, calendarAutoEventIdRef);
    });

    calendar.onWorkEnd(async () => {
      const sessionId = calendarAutoSessionIdRef.current;
      if (!sessionId || !userId) return;
      try {
        await stopMonitoringSession(sessionId, userId);
      } catch (err: any) {
        console.error('[ProductivityDashboard] Calendar auto-stop failed:', err.message);
      } finally {
        calendarAutoSessionIdRef.current = null;
        calendarAutoEventIdRef.current = null;
        manuallyStoppedEventIdRef.current = null;
        setAutoSessionInfo(null);
      }
    });
  }, [userId]);

  const handleManualStop = useCallback(() => {
    manuallyStoppedEventIdRef.current = calendarAutoEventIdRef.current;
    calendarAutoSessionIdRef.current = null;
    calendarAutoEventIdRef.current = null;
    setAutoSessionInfo(null);
  }, []);

  return { autoSessionInfo, handleManualStop };
}

async function startCalendarSession(userId: string, event: any, setInfo: (info: AutoSessionInfo) => void, sessionRef: any, eventRef: any) {
  const session = await startMonitoringSession(userId, 'calendar_auto', event.title);
  sessionRef.current = session.id;
  eventRef.current = event.id;
  setInfo({ sessionId: session.id, eventTitle: event.title });
}
