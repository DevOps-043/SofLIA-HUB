import type { CalendarServiceCore } from './types';

export async function createEvent(service: CalendarServiceCore, event: {
  title: string;
  start: Date;
  end: Date;
  description?: string;
  location?: string;
  calendarId?: string;
}, beforeExecute: () => void = () => {}) {
  const auth = await service.getGoogleAuth();
  if (!auth) return { success: false, error: 'Google no conectado' };

  try {
    const { google } = await import('googleapis');
    const calendar = google.calendar({ version: 'v3', auth });
    beforeExecute();
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
    console.info('[Calendario] Evento creado.');
    return { success: true, eventId: response.data.id || undefined };
  } catch {
    console.error('[Calendario] No se pudo crear el evento.');
    return { success: false, error: 'No se pudo completar el cambio en Google Calendar.' };
  }
}
