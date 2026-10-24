import { useCallback, useEffect, useRef, useState } from 'react';
import { calendarClient } from '../../../services/calendar';
import type {} from '../../connections-panel/window-connections';
import { getUpcomingEvents, mapCalendarEvents } from './event-utils';
import type { CalendarConnection, CalendarEvent, CalendarProvider } from './types';

type LoadingState = CalendarProvider | 'refresh' | null;
const message = (error: unknown) => error instanceof Error ? error.message : 'No se pudo consultar el calendario.';

export function useCalendarPanel() {
  const [connections, setConnections] = useState<CalendarConnection[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isAutoMode, setIsAutoMode] = useState(false);
  const [loading, setLoading] = useState<LoadingState>(null);
  const [error, setError] = useState<string | null>(null);
  const generation = useRef(0);
  const refreshSequence = useRef(0);

  const refreshEvents = useCallback(async () => {
    const client = calendarClient(); if (!client) return;
    const scope = generation.current; const sequence = ++refreshSequence.current;
    try {
      const next = await client.getEvents();
      if (generation.current === scope && refreshSequence.current === sequence) { setEvents(mapCalendarEvents(next)); setError(null); }
    } catch (failure) {
      if (generation.current === scope && refreshSequence.current === sequence) setError(message(failure));
    }
  }, []);

  useEffect(() => {
    const calendar = window.calendar; if (!calendar) return;
    const scope = ++generation.current;
    const active = () => generation.current === scope;
    const failed = (failure: unknown) => { if (active()) setError(message(failure)); };
    void calendar.getConnections().then(value => { if (active()) setConnections(value); }).catch(failed);
    void calendar.getStatus().then(value => { if (active()) setIsAutoMode(value.isPolling); }).catch(failed);
    const sequence = ++refreshSequence.current;
    void calendarClient(calendar)!.getEvents().then(next => {
      if (active() && refreshSequence.current === sequence) setEvents(mapCalendarEvents(next));
    }).catch(failed);
    const subscriptions = [
      calendar.onConnected(data => {
        if (!active()) return;
        setConnections(prev => [...prev.filter(item => item.provider !== data.provider), { ...data, isActive: true }]);
        void refreshEvents();
      }),
      calendar.onDisconnected(data => {
        if (!active()) return;
        ++refreshSequence.current;
        setConnections(prev => prev.filter(item => item.provider !== data.provider));
        setEvents(prev => prev.filter(item => item.source !== data.provider));
      }),
      calendar.onPoll(data => {
        if (active()) { ++refreshSequence.current; setEvents(mapCalendarEvents(data.events)); }
      }),
    ];
    return () => { generation.current = scope + 1; subscriptions.forEach(unsubscribe => unsubscribe()); };
  }, [refreshEvents]);

  const handleConnect = async (provider: CalendarProvider) => {
    const calendar = window.calendar;
    if (!calendar) { setError('Calendario no disponible'); return; }
    const scope = generation.current; setLoading(provider); setError(null);
    try {
      const result = provider === 'google' ? await calendar.connectGoogle() : await calendar.connectMicrosoft();
      if (generation.current !== scope) return;
      if (!result.success) { setError(result.error || 'Error de conexión'); return; }
      setConnections(prev => [...prev.filter(item => item.provider !== provider), { provider, email: result.email, isActive: true }]);
      await refreshEvents();
    } catch (failure) { if (generation.current === scope) setError(message(failure)); }
    finally { if (generation.current === scope) setLoading(null); }
  };
  const handleDisconnect = async (provider: CalendarProvider) => {
    const calendar = window.calendar; if (!calendar) return;
    const scope = generation.current;
    try {
      const result = await calendar.disconnect(provider);
      if (generation.current !== scope) return;
      if (!result.success) { setError(result.error || 'No se pudo desconectar.'); return; }
      ++refreshSequence.current; setEvents(prev => prev.filter(item => item.source !== provider)); setConnections(prev => prev.filter(item => item.provider !== provider));
    } catch (failure) { if (generation.current === scope) setError(message(failure)); }
  };
  const toggleAutoMode = async () => {
    const calendar = window.calendar; if (!calendar) return;
    const scope = generation.current;
    try {
      const result = isAutoMode ? await calendar.stopAuto() : await calendar.startAuto();
      if (generation.current !== scope) return;
      if (!result.success) { setError(result.error || 'No se pudo cambiar el modo automático.'); return; }
      const status = await calendar.getStatus();
      if (generation.current === scope) setIsAutoMode(status.isPolling);
    } catch (failure) { if (generation.current === scope) setError(message(failure)); }
  };
  const refreshWithLoading = async () => {
    const scope = generation.current; setLoading('refresh');
    try { await refreshEvents(); } finally { if (generation.current === scope) setLoading(null); }
  };
  return { connections, error, handleConnect, handleDisconnect, isAutoMode, loading, refreshEvents: refreshWithLoading,
    toggleAutoMode, upcomingEvents: getUpcomingEvents(events) };
}
