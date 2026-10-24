import type { CalendarConnection, CalendarEvent, CalendarServiceCore } from './types';
import { z } from 'zod';

const microsoftDate = z.object({ dateTime: z.string().transform(value =>
  new Date(/(?:Z|[+-]\d{2}:\d{2})$/i.test(value) ? value : value + 'Z')).pipe(z.date()) });
const microsoftEvents = z.object({ value: z.array(z.object({
  id: z.string().optional(), subject: z.string().optional(), start: microsoftDate, end: microsoftDate,
  isAllDay: z.boolean().optional(), location: z.object({ displayName: z.string().optional() }).optional(),
  body: z.object({ content: z.string().optional() }).optional(),
})).max(20).default([]) });

export async function fetchGoogleEvents(
  service: CalendarServiceCore,
  conn: CalendarConnection,
  start: Date,
  end: Date,
  assert: () => void = () => {},
): Promise<CalendarEvent[]> {
  const { google } = await import('googleapis');
  const oauth2Client = await service.getGoogleAuth();
  if (!oauth2Client) throw new Error('Google no conectado.');
  assert();
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

export async function fetchMicrosoftEvents(conn: CalendarConnection, start: Date, end: Date, assert: () => void = () => {}): Promise<CalendarEvent[]> {
  const { Client } = await import('@microsoft/microsoft-graph-client');
  assert();
  const client = Client.init({
    authProvider: done => done(null, conn.accessToken),
  });
  const response = microsoftEvents.parse(await client
    .api('/me/calendarview')
    .query({ startDateTime: start.toISOString(), endDateTime: end.toISOString() })
    .select('id,subject,start,end,isAllDay,location,body')
    .orderby('start/dateTime')
    .top(20)
    .get());

  return response.value.map(item => ({
    id: item.id || '',
    title: item.subject || 'Sin titulo',
    start: item.start.dateTime,
    end: item.end.dateTime,
    isAllDay: item.isAllDay || false,
    location: item.location?.displayName || undefined,
    description: item.body?.content || undefined,
    source: 'microsoft' as const,
  }));
}
