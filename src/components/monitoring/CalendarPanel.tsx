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
      onDisconnected: (cb: (data: any) => void) => void;
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

    // Listen for auto-restored or new connections (e.g. after app restart)
    window.calendar.onConnected((data) => {
      setConnections(prev => {
        const filtered = prev.filter(c => c.provider !== data.provider);
        return [...filtered, { provider: data.provider, email: data.email, isActive: true }];
      });
      // Refresh events when a connection is restored
      window.calendar.getEvents().then(evts => {
        setEvents(evts.map((e: any) => ({ ...e, start: new Date(e.start), end: new Date(e.end) })));
      }).catch(() => {});
    });

    // Listen for failed session restores or disconnections
    window.calendar.onDisconnected((data) => {
      setConnections(prev => prev.filter(c => c.provider !== data.provider));
    });

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
    <div className="relative">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h3 className="text-sm font-black text-white tracking-tight">Calendario</h3>
          <p className="text-[10px] text-gray-500 uppercase tracking-widest mt-0.5">Sincronización de eventos</p>
        </div>
        <div className="flex items-center gap-2">
          {connections.length > 0 && (
            <>
              <button
                onClick={async () => {
                  setLoading('refresh');
                  const evts = await window.calendar.getEvents();
                  setEvents(evts.map(e => ({ ...e, start: new Date(e.start), end: new Date(e.end) })));
                  setLoading(null);
                }}
                className={`p-2 rounded-xl bg-white/5 border border-white/10 text-gray-400 hover:text-white transition-all ${loading === 'refresh' ? 'animate-spin' : ''}`}
                title="Sincronizar ahora"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
              <button
                onClick={toggleAutoMode}
                className={`group/auto relative flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all duration-300 ${
                  isAutoMode
                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                    : 'bg-white/5 border-white/10 text-gray-500 hover:text-white hover:bg-white/10'
                }`}
              >
                    <span className={`w-2 h-2 rounded-full ${isAutoMode ? 'bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.8)]' : 'bg-gray-600'}`} />
                <div className="absolute -top-10 left-1/2 -translate-x-1/2 px-2 py-1 bg-black/80 backdrop-blur-md rounded-lg text-[8px] font-black uppercase tracking-tighter opacity-0 group-hover/auto:opacity-100 transition-opacity whitespace-nowrap border border-white/5">
                  Modo: {isAutoMode ? 'Automático' : 'Manual'}
                </div>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Integration Cards */}
      <div className="space-y-3 mb-8">
        <div className="group/conn flex items-center justify-between p-4 rounded-2xl bg-white/2 border border-white/5 hover:bg-white/5 transition-all">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center border border-white/5 shrink-0">
              <svg className="h-5 w-5" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
            </div>
            <div className="min-w-0">
              {googleConn && <p className="text-[11px] text-gray-400 truncate font-mono tracking-tighter">{googleConn.email}</p>}
            </div>
          </div>
          <div className="shrink-0 ml-3">
            {googleConn ? (
              <button onClick={() => handleDisconnect('google')} className="p-2 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-400/5 transition-all">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
              </button>
            ) : (
              <button onClick={() => handleConnect('google')} disabled={loading === 'google'} className="text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-xl bg-white text-black hover:bg-gray-200 transition-all disabled:opacity-50 active:scale-95">
                {loading === 'google' ? '...' : 'Conectar'}
              </button>
            )}
          </div>
        </div>

        <div className="group/conn flex items-center justify-between p-4 rounded-2xl bg-white/2 border border-white/5 hover:bg-white/5 transition-all">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center border border-white/5 shrink-0">
              <svg className="h-5 w-5" viewBox="0 0 24 24">
                <path fill="#F25022" d="M1 1h10v10H1z"/><path fill="#00A4EF" d="M1 13h10v10H1z"/><path fill="#7FBA00" d="M13 1h10v10H13z"/><path fill="#FFB900" d="M13 13h10v10H13z"/>
              </svg>
            </div>
            <div className="min-w-0">
              {microsoftConn && <p className="text-[11px] text-gray-400 truncate font-mono tracking-tighter">{microsoftConn.email}</p>}
            </div>
          </div>
          <div className="shrink-0 ml-3">
            {microsoftConn ? (
              <button onClick={() => handleDisconnect('microsoft')} className="p-2 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-400/5 transition-all">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
              </button>
            ) : (
              <button onClick={() => handleConnect('microsoft')} disabled={loading === 'microsoft'} className="text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-xl bg-white text-black hover:bg-gray-200 transition-all disabled:opacity-50 active:scale-95">
                {loading === 'microsoft' ? '...' : 'Conectar'}
              </button>
            )}
          </div>
        </div>
      </div>

      {error && <p className="text-[10px] font-bold text-red-500 mb-6 bg-red-500/5 p-3 rounded-xl border border-red-500/10 text-center uppercase tracking-tighter">{error}</p>}

      {/* Events Timeline */}
      {upcomingEvents.length > 0 ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.3em]">Agenda de Hoy</h4>
            <span className="text-[10px] font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full">{upcomingEvents.length} eventos</span>
          </div>
          <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
            {upcomingEvents.map(event => {
              const now = new Date();
              const isActive = now >= new Date(event.start) && now <= new Date(event.end);
              return (
                <div
                  key={event.id}
                  className={`relative group/event flex items-center gap-4 p-3 rounded-2xl transition-all duration-300 ${
                    isActive
                      ? 'bg-indigo-500 text-white shadow-xl shadow-indigo-500/20 rotate-1'
                      : 'bg-white/2 border border-white/5 hover:bg-white/5'
                  }`}
                >
                  <div className={`w-1 h-8 rounded-full shrink-0 ${
                    isActive ? 'bg-white' : event.source === 'google' ? 'bg-[#4285F4]' : 'bg-[#00A4EF]'
                  }`} />
                  
                  <div className="min-w-0 flex-1">
                    <p className={`text-xs font-black truncate tracking-tight ${isActive ? 'text-white' : 'text-gray-300'}`}>
                      {event.title}
                    </p>
                    <p className={`text-[10px] font-bold font-mono ${isActive ? 'text-white/60' : 'text-gray-500'}`}>
                      {formatTime(new Date(event.start))} — {formatTime(new Date(event.end))}
                    </p>
                  </div>
                  
                  {isActive && (
                    <div className="absolute top-2 right-3">
                      <span className="flex h-2 w-2 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        connections.length > 0 && (
          <div className="py-8 text-center border-2 border-dashed border-white/5 rounded-3xl">
            <p className="text-[10px] font-black text-gray-600 uppercase tracking-widest">Sin eventos próximos</p>
          </div>
        )
      )}

      {connections.length === 0 && (
        <div className="p-6 text-center bg-indigo-500/5 border border-indigo-500/10 rounded-3xl">
          <p className="text-xs font-bold text-indigo-400 leading-relaxed">
            Conecta tu calendario para sincronizar tu agenda automáticamente.
          </p>
        </div>
      )}
    </div>
  );
}
