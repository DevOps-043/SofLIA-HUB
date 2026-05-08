import type { CalendarEventData } from './types';

export async function collectCalendarEvents(calendarService: any): Promise<CalendarEventData[]> {
  if (!calendarService) return [];
  const events = await calendarService.getCurrentEvents();
  return (events || []).map((event: any) => ({
    title: event.title,
    start: formatEventTime(event.start),
    end: formatEventTime(event.end),
    location: event.location,
    description: event.description,
  }));
}

function formatEventTime(value: unknown): string {
  return value instanceof Date
    ? value.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
    : String(value);
}
