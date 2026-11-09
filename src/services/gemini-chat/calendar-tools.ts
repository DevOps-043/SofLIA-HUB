import type { WorkspaceApis } from './workspace-api';
import { unavailable } from './workspace-api';

export async function executeCalendarTool(toolName: string, args: Record<string, unknown>, apis: WorkspaceApis): Promise<string | null> {
  const { cal } = apis;
  switch (toolName) {
    case 'google_calendar_get_connections':
      if (!cal) return unavailable('Calendario no disponible. El usuario debe conectar su calendario primero desde la seccion de Productividad.');
      return JSON.stringify({ connections: await cal.getConnections() });
    case 'google_calendar_get_events': {
      if (!cal) return unavailable('Calendario no conectado.');
      const events = await cal.getEvents();
      if (args.date && events && Array.isArray(events)) {
        const filtered = events.filter(event => event.start.slice(0, 10) === args.date);
        return JSON.stringify({ events: filtered, date: args.date });
      }
      return JSON.stringify({ events });
    }
    case 'google_calendar_create':
      if (!cal) return unavailable('Calendario no conectado.');
      return JSON.stringify(await cal.createEvent({
        title: String(args.title || ''),
        start: String(args.start || ''),
        end: String(args.end || ''),
        description: typeof args.description === 'string' ? args.description : '',
        location: typeof args.location === 'string' ? args.location : '',
      }));
    case 'google_calendar_delete':
      if (!cal) return unavailable('Calendario no conectado.');
      return JSON.stringify(await cal.deleteEvent(String(args.event_id || '')));
    default:
      return null;
  }
}
