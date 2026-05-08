import type { CalendarEvent } from './types';

export function normalizeEvents(events: any[]): CalendarEvent[] {
  return events.map(e => ({ ...e, start: new Date(e.start), end: new Date(e.end) }));
}

export function formatEventTime(date: Date) {
  return date.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
}

export function getUpcomingEvents(events: CalendarEvent[]) {
  return events.filter(e => !e.isAllDay && new Date(e.end) > new Date()).slice(0, 4);
}
