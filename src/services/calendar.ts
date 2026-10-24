import type { CalendarBridge, CalendarCreateInput, CalendarUpdateInput } from '../shared/calendar';
import type {} from '../components/connections-panel/window-connections';

/** Adaptador renderer: el sobre IPC no se filtra a los consumidores de eventos. */
export function calendarClient(bridge: CalendarBridge | undefined = window.calendar) {
  if (!bridge) return null;
  return {
    getConnections: () => bridge.getConnections(),
    getEvents: async () => {
      const result = await bridge.getEvents();
      if (!result.success) throw new Error(result.error || 'No se pudieron consultar los eventos.');
      return result.events;
    },
    createEvent: (input: CalendarCreateInput) => bridge.createEvent(input),
    updateEvent: (id: string, input: CalendarUpdateInput) => bridge.updateEvent(id, input),
    deleteEvent: (id: string, calendarId?: string) => bridge.deleteEvent(id, calendarId),
  };
}
