import { useEffect, useState } from 'react';
import './window-connections';
import type { CalendarConnection, CalendarConnectionsState } from './types';

export function useCalendarConnections(): CalendarConnectionsState {
  const [connections, setConnections] = useState<CalendarConnection[]>([]);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const calendar = window.calendar;
    if (!calendar) return;
    calendar.getConnections().then(setConnections).catch(() => {});
    calendar.onConnected((data: any) => {
      setConnections((prev) => [...prev.filter((item) => item.provider !== data.provider), {
        provider: data.provider,
        email: data.email,
        isActive: true,
      }]);
    });
    calendar.onDisconnected((data: any) => {
      setConnections((prev) => prev.filter((item) => item.provider !== data.provider));
    });
    return () => calendar.removeListeners();
  }, []);

  const connect = async (provider: 'google' | 'microsoft') => {
    setLoading(provider);
    setError(null);
    const calendar = window.calendar;
    if (!calendar) {
      setError('Calendario no disponible');
      setLoading(null);
      return;
    }
    try {
      const result = provider === 'google'
        ? await calendar.connectGoogle()
        : await calendar.connectMicrosoft();
      if (result.success) {
        setConnections((prev) => [...prev.filter((item) => item.provider !== provider), {
          provider,
          email: result.email,
          isActive: true,
        }]);
      } else {
        setError(result.error || 'Error de conexion');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(null);
    }
  };

  const disconnect = async (provider: 'google' | 'microsoft') => {
    const calendar = window.calendar;
    if (!calendar) return;
    await calendar.disconnect(provider);
    setConnections((prev) => prev.filter((item) => item.provider !== provider));
  };

  return {
    google: connections.find((item) => item.provider === 'google'),
    microsoft: connections.find((item) => item.provider === 'microsoft'),
    loading,
    error,
    connect,
    disconnect,
  };
}
