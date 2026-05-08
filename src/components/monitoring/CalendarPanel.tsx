import { CalendarToolbar } from './calendar-panel/CalendarToolbar';
import { ConnectionCard } from './calendar-panel/ConnectionCard';
import { EventsTimeline } from './calendar-panel/EventsTimeline';
import { useCalendarPanel } from './calendar-panel/useCalendarPanel';

export function CalendarPanel() {
  const calendar = useCalendarPanel();
  const googleConn = calendar.connections.find(connection => connection.provider === 'google');
  const microsoftConn = calendar.connections.find(connection => connection.provider === 'microsoft');

  return (
    <div className="relative">
      <CalendarToolbar
        connectionCount={calendar.connections.length}
        isAutoMode={calendar.isAutoMode}
        loading={calendar.loading}
        onRefresh={calendar.refreshEvents}
        onToggleAutoMode={calendar.toggleAutoMode}
      />

      <div className="space-y-3 mb-8">
        <ConnectionCard
          connection={googleConn}
          loading={calendar.loading === 'google'}
          provider="google"
          onConnect={calendar.handleConnect}
          onDisconnect={calendar.handleDisconnect}
        />
        <ConnectionCard
          connection={microsoftConn}
          loading={calendar.loading === 'microsoft'}
          provider="microsoft"
          onConnect={calendar.handleConnect}
          onDisconnect={calendar.handleDisconnect}
        />
      </div>

      {calendar.error && (
        <p className="text-[10px] font-bold text-red-500 mb-6 bg-red-500/5 p-3 rounded-xl border border-red-500/10 text-center uppercase tracking-tighter">
          {calendar.error}
        </p>
      )}

      <EventsTimeline connectionCount={calendar.connections.length} events={calendar.upcomingEvents} />

      {calendar.connections.length === 0 && (
        <div className="p-6 text-center bg-indigo-500/5 border border-indigo-500/10 rounded-3xl">
          <p className="text-xs font-bold text-indigo-400 leading-relaxed">
            Conecta tu calendario para sincronizar tu agenda automaticamente.
          </p>
        </div>
      )}
    </div>
  );
}
