import { fetchGoogleEvents, fetchMicrosoftEvents } from './event-fetchers';
import { calendarSession } from './session-context';
import { createLogger } from '../utils/logger';
import type { CalendarEvent, CalendarServiceCore } from './types';

const log = createLogger('calendario-consultas');
export async function getCurrentEvents(service: CalendarServiceCore, targetDate?: Date): Promise<CalendarEvent[]> {
  if (!service.userId) return [];
  const assert = calendarSession(service);
  const events: CalendarEvent[] = [];
  const connections: (() => void)[] = [];
  const now = targetDate ? new Date(targetDate) : new Date();
  const startOfQuery = targetDate ? startOfDay(targetDate) : now;
  const endOfDay = new Date(now); endOfDay.setHours(23, 59, 59, 999);
  const googleConn = service.connections.get('google');
  if (googleConn?.isActive) {
    const current = calendarSession(service, googleConn);
    connections.push(current);
    try {
      current(); const next = await fetchGoogleEvents(service, googleConn, now, endOfDay, current); current(); events.push(...next);
    } catch { current(); log.warn('No se pudo consultar Google Calendar.'); }
  }
  const microsoftConn = service.connections.get('microsoft');
  if (microsoftConn?.isActive) {
    const current = calendarSession(service, microsoftConn);
    connections.push(current);
    try {
      current(); const next = await fetchMicrosoftEvents(microsoftConn, startOfQuery, endOfDay, current); current(); events.push(...next);
    } catch { current(); log.warn('No se pudo consultar Microsoft Calendar.'); }
  }
  assert();
  connections.forEach(current => current());
  return events.sort((a, b) => a.start.getTime() - b.start.getTime());
}
function startOfDay(date: Date): Date { const result = new Date(date); result.setHours(0, 0, 0, 0); return result; }
