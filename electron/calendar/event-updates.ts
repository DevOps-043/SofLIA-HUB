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
  beforeExecute: () => void = () => {},
) {
  const auth = await service.getGoogleAuth();
  if (!auth) return { success: false, error: 'Google no conectado' };

  try {
    const { google } = await import('googleapis');
    const calendar = google.calendar({ version: 'v3', auth });
    const requestBody: { summary?: string; description?: string; location?: string; start?: { dateTime: string }; end?: { dateTime: string } } = {};
    if (updates.title) requestBody.summary = updates.title;
    if (updates.description !== undefined) requestBody.description = updates.description;
    if (updates.location !== undefined) requestBody.location = updates.location;
    if (updates.start) requestBody.start = { dateTime: updates.start.toISOString() };
    if (updates.end) requestBody.end = { dateTime: updates.end.toISOString() };
    beforeExecute();
    await calendar.events.patch({ calendarId: updates.calendarId || 'primary', eventId, requestBody });
    console.info('[Calendario] Evento actualizado.');
    return { success: true };
  } catch {
    console.error('[Calendario] No se pudo actualizar el evento.');
    return { success: false, error: 'No se pudo completar el cambio en Google Calendar.' };
  }
}

export async function deleteEvent(service: CalendarServiceCore, eventId: string, calendarId?: string, beforeExecute: () => void = () => {}) {
  const auth = await service.getGoogleAuth();
  if (!auth) return { success: false, error: 'Google no conectado' };

  try {
    const { google } = await import('googleapis');
    const calendar = google.calendar({ version: 'v3', auth });
    beforeExecute();
    await calendar.events.delete({ calendarId: calendarId || 'primary', eventId });
    console.info('[Calendario] Evento eliminado.');
    return { success: true };
  } catch {
    console.error('[Calendario] No se pudo eliminar el evento.');
    return { success: false, error: 'No se pudo completar el cambio en Google Calendar.' };
  }
}
