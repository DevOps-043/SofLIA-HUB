import type { CalendarConnection, CalendarEvent, CalendarServiceCore } from './types';

export async function fetchGoogleEvents(
  service: CalendarServiceCore,
  conn: CalendarConnection,
  start: Date,
  end: Date,
): Promise<CalendarEvent[]> {
  const { google } = await import('googleapis');
  const oauth2Client = await service.getGoogleAuth();
  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
  const response = await calendar.events.list({
    calendarId: conn.calendarId || 'primary',
    timeMin: start.toISOString(),
    timeMax: end.toISOString(),
    singleEvents: true,
    orderBy: 'startTime',
    maxResults: 20,
  });

  return (response.data.items || []).map((item) => ({
    id: item.id || '',
    title: item.summary || 'Sin titulo',
    start: new Date(item.start?.dateTime || item.start?.date || ''),
    end: new Date(item.end?.dateTime || item.end?.date || ''),
    isAllDay: !item.start?.dateTime,
    location: item.location || undefined,
    description: item.description || undefined,
    source: 'google' as const,
  }));
}

export async function fetchMicrosoftEvents(conn: CalendarConnection, start: Date, end: Date): Promise<CalendarEvent[]> {
  const { Client } = await import('@microsoft/microsoft-graph-client');
  const client = Client.init({
    authProvider: (done: (error: any, accessToken: string | null) => void) => done(null, conn.accessToken),
  });
  const response = await client
    .api('/me/calendarview')
    .query({ startDateTime: start.toISOString(), endDateTime: end.toISOString() })
    .select('id,subject,start,end,isAllDay,location,body')
    .orderby('start/dateTime')
    .top(20)
    .get();

  return (response.value || []).map((item: any) => ({
    id: item.id || '',
    title: item.subject || 'Sin titulo',
    start: new Date(`${item.start?.dateTime}Z`),
    end: new Date(`${item.end?.dateTime}Z`),
    isAllDay: item.isAllDay || false,
    location: item.location?.displayName || undefined,
    description: item.body?.content || undefined,
    source: 'microsoft' as const,
  }));
}
