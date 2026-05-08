import { useEffect, useState } from 'react';
import '../../connections-panel/window-connections';
import { getUpcomingEvents, mapCalendarEvents } from './event-utils';
import type { CalendarConnection, CalendarEvent, CalendarProvider } from './types';

type LoadingState = CalendarProvider | 'refresh' | null;

export function useCalendarPanel() {
  const [connections, setConnections] = useState<CalendarConnection[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isAutoMode, setIsAutoMode] = useState(false);
  const [loading, setLoading] = useState<LoadingState>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const calendar = window.calendar;
    if (!calendar) return;

    calendar.getConnections().then(setConnections).catch(() => {});
    calendar.getStatus().then(status => setIsAutoMode(status.isPolling)).catch(() => {});
    refreshEvents().catch(() => {});

    calendar.onConnected((data) => {
      setConnections(prev => [
        ...prev.filter(connection => connection.provider !== data.provider),
        { provider: data.provider, email: data.email, isActive: true },
      ]);
      refreshEvents().catch(() => {});
    });
    calendar.onDisconnected((data) => {
      setConnections(prev => prev.filter(connection => connection.provider !== data.provider));
    });
    calendar.onPoll((data) => {
      if (data.events) setEvents(mapCalendarEvents(data.events));
    });

    return () => calendar.removeListeners();
  }, []);

  const refreshEvents = async () => {
    const calendar = window.calendar;
    if (!calendar) return;
    const calendarEvents = await calendar.getEvents();
    setEvents(mapCalendarEvents(calendarEvents));
  };

  const handleConnect = async (provider: CalendarProvider) => {
    const calendar = window.calendar;
    if (!calendar) {
      setError('Calendario no disponible');
      return;
    }
    setLoading(provider);
    setError(null);
    try {
      const result = provider === 'google'
        ? await calendar.connectGoogle()
        : await calendar.connectMicrosoft();
      if (!result.success) {
        setError(result.error || 'Error de conexion');
        return;
      }
      setConnections(prev => [
        ...prev.filter(connection => connection.provider !== provider),
        { provider, email: result.email, isActive: true },
      ]);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(null);
    }
  };

  const handleDisconnect = async (provider: CalendarProvider) => {
    const calendar = window.calendar;
    if (!calendar) return;
    await calendar.disconnect(provider);
    setConnections(prev => prev.filter(connection => connection.provider !== provider));
  };

  const toggleAutoMode = async () => {
    const calendar = window.calendar;
    if (!calendar) return;
    if (isAutoMode) await calendar.stopAuto();
    else await calendar.startAuto();
    setIsAutoMode(!isAutoMode);
  };

  return {
    connections,
    error,
    handleConnect,
    handleDisconnect,
    isAutoMode,
    loading,
    refreshEvents: withRefreshLoading(refreshEvents, setLoading),
    toggleAutoMode,
    upcomingEvents: getUpcomingEvents(events),
  };
}

function withRefreshLoading(refresh: () => Promise<void>, setLoading: (state: LoadingState) => void) {
  return async () => {
    setLoading('refresh');
    try {
      await refresh();
    } finally {
      setLoading(null);
    }
  };
}
