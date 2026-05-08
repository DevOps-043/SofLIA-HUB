import type { CalendarEvent } from './types';

export function mapCalendarEvents(events: any[]): CalendarEvent[] {
  return events.map(event => ({
    ...event,
    start: new Date(event.start),
    end: new Date(event.end),
  }));
}

export function getUpcomingEvents(events: CalendarEvent[]): CalendarEvent[] {
  const now = new Date();
  return events.filter(event => !event.isAllDay && new Date(event.end) > now).slice(0, 4);
}

export function formatEventTime(date: Date): string {
  return date.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
}
