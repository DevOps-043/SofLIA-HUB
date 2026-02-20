import { useState, useEffect } from 'react';

interface CalendarConnection {
  provider: 'google' | 'microsoft';
  email?: string;
  isActive: boolean;
}

interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  isAllDay: boolean;
  source: 'google' | 'microsoft';
}

declare global {
  interface Window {
    calendar: {
      connectGoogle: () => Promise<{ success: boolean; email?: string; error?: string }>;
      connectMicrosoft: () => Promise<{ success: boolean; email?: string; error?: string }>;
      disconnect: (provider: string) => Promise<void>;
      getEvents: () => Promise<CalendarEvent[]>;
      getConnections: () => Promise<CalendarConnection[]>;
      startAuto: () => Promise<void>;
      stopAuto: () => Promise<void>;
      getStatus: () => Promise<{ isPolling: boolean; inWorkHours: boolean; currentEvent: CalendarEvent | null }>;
      onWorkStart: (cb: (data: any) => void) => void;
      onWorkEnd: (cb: (data: any) => void) => void;
      onConnected: (cb: (data: any) => void) => void;
      onPoll: (cb: (data: any) => void) => void;
      removeListeners: () => void;
    };
  }
}

export function CalendarPanel() {
  const [connections, setConnections] = useState<CalendarConnection[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isAutoMode, setIsAutoMode] = useState(false);
  const [inWorkHours, setInWorkHours] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window.calendar === 'undefined') return;

    window.calendar.getConnections().then(setConnections).catch(() => {});
    window.calendar.getStatus().then(s => {
      setIsAutoMode(s.isPolling);
      setInWorkHours(s.inWorkHours);
    }).catch(() => {});
    window.calendar.getEvents().then(evts => {
      setEvents(evts.map(e => ({ ...e, start: new Date(e.start), end: new Date(e.end) })));
    }).catch(() => {});

    window.calendar.onPoll((data) => {
      setInWorkHours(data.inWorkHours);
      if (data.events) {
        setEvents(data.events.map((e: any) => ({ ...e, start: new Date(e.start), end: new Date(e.end) })));
      }
    });

    return () => window.calendar.removeListeners();
  }, []);

  const handleConnect = async (provider: 'google' | 'microsoft') => {
    setLoading(provider);
    setError(null);
    try {
      const result = provider === 'google'
        ? await window.calendar.connectGoogle()
        : await window.calendar.connectMicrosoft();

      if (result.success) {
        setConnections(prev => [...prev.filter(c => c.provider !== provider), { provider, email: result.email, isActive: true }]);
      } else {
        setError(result.error || 'Error de conexion');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(null);
    }
  };

  const handleDisconnect = async (provider: 'google' | 'microsoft') => {
    await window.calendar.disconnect(provider);
    setConnections(prev => prev.filter(c => c.provider !== provider));
  };

  const toggleAutoMode = async () => {
    if (isAutoMode) {
      await window.calendar.stopAuto();
      setIsAutoMode(false);
    } else {
      await window.calendar.startAuto();
      setIsAutoMode(true);
    }
  };

  const googleConn = connections.find(c => c.provider === 'google');
  const microsoftConn = connections.find(c => c.provider === 'microsoft');

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
  };

  const upcomingEvents = events
    .filter(e => !e.isAllDay && new Date(e.end) > new Date())
    .slice(0, 4);

  return (
    <div className="bg-white dark:bg-white/5 rounded-xl border border-gray-200 dark:border-white/10 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Calendario</h3>
        {connections.length > 0 && (
          <button
            onClick={toggleAutoMode}
            className={`text-xs px-2.5 py-1 rounded-full font-medium transition-colors ${
              isAutoMode
                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                : 'bg-gray-100 text-gray-500 dark:bg-white/5 dark:text-gray-400'
            }`}
          >
            {isAutoMode ? 'Auto ON' : 'Auto OFF'}
          </button>
        )}
      </div>

      {/* Connection buttons */}
      <div className="space-y-2 mb-4">
        {/* Google */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg className="h-4 w-4" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            <span className="text-sm text-gray-700 dark:text-gray-300">Google</span>
          </div>
          {googleConn ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400 truncate max-w-[120px]">{googleConn.email}</span>
              <button onClick={() => handleDisconnect('google')} className="text-xs text-red-500 hover:text-red-600">
                Desconectar
              </button>
            </div>
          ) : (
            <button
              onClick={() => handleConnect('google')}
              disabled={loading === 'google'}
              className="text-xs px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-50"
            >
              {loading === 'google' ? 'Conectando...' : 'Conectar'}
            </button>
          )}
        </div>

        {/* Microsoft */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg className="h-4 w-4" viewBox="0 0 24 24">
              <path fill="#F25022" d="M1 1h10v10H1z"/>
              <path fill="#00A4EF" d="M1 13h10v10H1z"/>
              <path fill="#7FBA00" d="M13 1h10v10H13z"/>
              <path fill="#FFB900" d="M13 13h10v10H13z"/>
            </svg>
            <span className="text-sm text-gray-700 dark:text-gray-300">Microsoft</span>
          </div>
          {microsoftConn ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400 truncate max-w-[120px]">{microsoftConn.email}</span>
              <button onClick={() => handleDisconnect('microsoft')} className="text-xs text-red-500 hover:text-red-600">
                Desconectar
              </button>
            </div>
          ) : (
            <button
              onClick={() => handleConnect('microsoft')}
              disabled={loading === 'microsoft'}
              className="text-xs px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-50"
            >
              {loading === 'microsoft' ? 'Conectando...' : 'Conectar'}
            </button>
          )}
        </div>
      </div>

      {error && <p className="text-xs text-red-500 mb-3">{error}</p>}

      {/* Work hours indicator */}
      {isAutoMode && (
        <div className={`flex items-center gap-2 text-xs px-3 py-2 rounded-lg mb-3 ${
          inWorkHours
            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400'
            : 'bg-gray-50 text-gray-500 dark:bg-white/5 dark:text-gray-400'
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full ${inWorkHours ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-600'}`} />
          {inWorkHours ? 'En horario laboral' : 'Fuera de horario laboral'}
        </div>
      )}

      {/* Upcoming events */}
      {upcomingEvents.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[11px] uppercase tracking-wider text-gray-400 dark:text-gray-500 font-semibold">Eventos de hoy</p>
          {upcomingEvents.map(event => {
            const now = new Date();
            const isActive = now >= new Date(event.start) && now <= new Date(event.end);
            return (
              <div
                key={event.id}
                className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs ${
                  isActive
                    ? 'bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800'
                    : 'bg-gray-50 dark:bg-white/5'
                }`}
              >
                <span className={`w-1 h-6 rounded-full flex-shrink-0 ${
                  event.source === 'google' ? 'bg-blue-400' : 'bg-sky-400'
                }`} />
                <div className="min-w-0 flex-1">
                  <p className={`truncate font-medium ${isActive ? 'text-emerald-700 dark:text-emerald-400' : 'text-gray-700 dark:text-gray-300'}`}>
                    {event.title}
                  </p>
                  <p className="text-gray-400 dark:text-gray-500">
                    {formatTime(new Date(event.start))} — {formatTime(new Date(event.end))}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {connections.length === 0 && (
        <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-2">
          Conecta tu calendario para activar el monitoreo automatico
        </p>
      )}
    </div>
  );
}
