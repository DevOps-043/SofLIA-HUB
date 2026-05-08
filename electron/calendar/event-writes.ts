import type { CalendarServiceCore } from './types';

export async function createEvent(service: CalendarServiceCore, event: {
  title: string;
  start: Date;
  end: Date;
  description?: string;
  location?: string;
  calendarId?: string;
}) {
  const auth = await service.getGoogleAuth();
  if (!auth) return { success: false, error: 'Google no conectado' };

  try {
    const { google } = await import('googleapis');
    const calendar = google.calendar({ version: 'v3', auth });
    const response = await calendar.events.insert({
      calendarId: event.calendarId || 'primary',
      requestBody: {
        summary: event.title,
        description: event.description,
        location: event.location,
        start: { dateTime: event.start.toISOString() },
        end: { dateTime: event.end.toISOString() },
      },
    });
    console.log(`[CalendarService] Event created: ${response.data.id}`);
    return { success: true, eventId: response.data.id || undefined };
  } catch (err: any) {
    console.error('[CalendarService] Create event error:', err.message);
    return { success: false, error: err.message };
  }
}
