import { fetchGoogleEvents, fetchMicrosoftEvents } from './event-fetchers';
import type { CalendarEvent, CalendarServiceCore } from './types';

export async function getCurrentEvents(
  service: CalendarServiceCore,
  targetDate?: Date,
): Promise<CalendarEvent[]> {
  const events: CalendarEvent[] = [];
  const now = targetDate ? new Date(targetDate) : new Date();
  const startOfQuery = targetDate ? startOfDay(targetDate) : now;
  const endOfDay = new Date(now);
  endOfDay.setHours(23, 59, 59, 999);

  const googleConn = service.connections.get('google');
  if (googleConn?.isActive) {
    try {
      events.push(...await fetchGoogleEvents(service, googleConn, now, endOfDay));
    } catch (err: any) {
      console.error('[CalendarService] Google fetch error:', err.message);
    }
  }

  const microsoftConn = service.connections.get('microsoft');
  if (microsoftConn?.isActive) {
    try {
      events.push(...await fetchMicrosoftEvents(microsoftConn, startOfQuery, endOfDay));
    } catch (err: any) {
      console.error('[CalendarService] Microsoft fetch error:', err.message);
    }
  }

  return events.sort((a, b) => a.start.getTime() - b.start.getTime());
}

function startOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}
