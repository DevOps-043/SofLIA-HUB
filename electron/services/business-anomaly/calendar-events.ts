import type { UpcomingMeeting } from './types';

export async function getUpcomingMeetings(calendarService: any): Promise<UpcomingMeeting[]> {
  if (!calendarService || typeof calendarService.getCurrentEvents !== 'function') {
    return [];
  }

  try {
    const events = await calendarService.getCurrentEvents(new Date());
    const now = Date.now();
    return events.map((event: any) => ({
      id: event.id || Math.random().toString(36).substring(7),
      title: event.title,
      timeToStart: new Date(event.start).getTime() - now,
      start: event.start,
    }));
  } catch (err: any) {
    console.error('[BusinessAnomalyMonitor] Error obteniendo eventos del calendario:', err.message);
    return [];
  }
}
