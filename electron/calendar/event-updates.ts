import type { CalendarServiceCore } from './types';

export async function updateEvent(
  service: CalendarServiceCore,
  eventId: string,
  updates: {
    title?: string;
    start?: Date;
    end?: Date;
    description?: string;
    location?: string;
    calendarId?: string;
  },
) {
  const auth = await service.getGoogleAuth();
  if (!auth) return { success: false, error: 'Google no conectado' };

  try {
    const { google } = await import('googleapis');
    const calendar = google.calendar({ version: 'v3', auth });
    const requestBody: any = {};
    if (updates.title) requestBody.summary = updates.title;
    if (updates.description !== undefined) requestBody.description = updates.description;
    if (updates.location !== undefined) requestBody.location = updates.location;
    if (updates.start) requestBody.start = { dateTime: updates.start.toISOString() };
    if (updates.end) requestBody.end = { dateTime: updates.end.toISOString() };
    await calendar.events.patch({ calendarId: updates.calendarId || 'primary', eventId, requestBody });
    console.log(`[CalendarService] Event updated: ${eventId}`);
    return { success: true };
  } catch (err: any) {
    console.error('[CalendarService] Update event error:', err.message);
    return { success: false, error: err.message };
  }
}

export async function deleteEvent(service: CalendarServiceCore, eventId: string, calendarId?: string) {
  const auth = await service.getGoogleAuth();
  if (!auth) return { success: false, error: 'Google no conectado' };

  try {
    const { google } = await import('googleapis');
    const calendar = google.calendar({ version: 'v3', auth });
    await calendar.events.delete({ calendarId: calendarId || 'primary', eventId });
    console.log(`[CalendarService] Event deleted: ${eventId}`);
    return { success: true };
  } catch (err: any) {
    console.error('[CalendarService] Delete event error:', err.message);
    return { success: false, error: err.message };
  }
}
