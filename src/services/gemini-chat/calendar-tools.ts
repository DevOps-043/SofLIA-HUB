import type { WorkspaceApis } from './workspace-api';
import { unavailable } from './workspace-api';

export async function executeCalendarTool(toolName: string, args: Record<string, any>, apis: WorkspaceApis): Promise<string | null> {
  const { cal } = apis;
  switch (toolName) {
    case 'google_calendar_get_connections':
      if (!cal) return unavailable('Calendario no disponible. El usuario debe conectar su calendario primero desde la seccion de Productividad.');
      return JSON.stringify({ connections: await cal.getConnections() });
    case 'google_calendar_get_events': {
      if (!cal) return unavailable('Calendario no conectado.');
      const events = await cal.getEvents();
      if (args.date && events && Array.isArray(events)) {
        const filtered = events.filter((event: any) => (event.start?.dateTime || event.start?.date || '').slice(0, 10) === args.date);
        return JSON.stringify({ events: filtered, date: args.date });
      }
      return JSON.stringify({ events });
    }
    case 'google_calendar_create':
      if (!cal) return unavailable('Calendario no conectado.');
      return JSON.stringify(await cal.createEvent({
        summary: args.title,
        start: { dateTime: args.start },
        end: { dateTime: args.end },
        description: args.description || '',
        location: args.location || '',
      }));
    case 'google_calendar_delete':
      if (!cal) return unavailable('Calendario no conectado.');
      return JSON.stringify(await cal.deleteEvent(args.event_id));
    default:
      return null;
  }
}
