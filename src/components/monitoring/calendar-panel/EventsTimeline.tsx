import { formatEventTime } from './event-utils';
import type { CalendarEvent } from './types';

type Props = {
  connectionCount: number;
  events: CalendarEvent[];
};

export function EventsTimeline({ connectionCount, events }: Props) {
  if (events.length === 0) {
    return connectionCount > 0 ? (
      <div className="py-8 text-center border-2 border-dashed border-white/5 rounded-3xl">
        <p className="text-[10px] font-black text-gray-600 uppercase tracking-widest">Sin eventos proximos</p>
      </div>
    ) : null;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.3em]">Agenda de Hoy</h4>
        <span className="text-[10px] font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full">
          {events.length} eventos
        </span>
      </div>
      <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
        {events.map(event => <EventRow event={event} key={event.id} />)}
      </div>
    </div>
  );
}

function EventRow({ event }: { event: CalendarEvent }) {
  const now = new Date();
  const isActive = now >= new Date(event.start) && now <= new Date(event.end);

  return (
    <div className={`relative group/event flex items-center gap-4 p-3 rounded-2xl transition-all duration-300 ${isActive ? 'bg-indigo-500 text-white shadow-xl shadow-indigo-500/20 rotate-1' : 'bg-white/2 border border-white/5 hover:bg-white/5'}`}>
      <div className={`w-1 h-8 rounded-full shrink-0 ${isActive ? 'bg-white' : event.source === 'google' ? 'bg-[#4285F4]' : 'bg-[#00A4EF]'}`} />
      <div className="min-w-0 flex-1">
        <p className={`text-xs font-black truncate tracking-tight ${isActive ? 'text-white' : 'text-gray-300'}`}>
          {event.title}
        </p>
        <p className={`text-[10px] font-bold font-mono ${isActive ? 'text-white/60' : 'text-gray-500'}`}>
          {formatEventTime(event.start)} - {formatEventTime(event.end)}
        </p>
      </div>
      {isActive && (
        <div className="absolute top-2 right-3">
          <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-white" />
          </span>
        </div>
      )}
    </div>
  );
}
