import type { CalendarService } from '../calendar-service';
import type { DriveFile, DriveService } from '../drive-service';
import { extractMeetingCode, hasGoogleMeetSignal } from './meeting-passive-detection-helpers';

export interface CalendarMeetingSignal {
  id: string;
  title: string;
  start: string;
  end: string;
  meetUrl?: string | null;
  meetingCode?: string | null;
}

export async function fetchRecentCalendarMeetings(calendarService: CalendarService): Promise<CalendarMeetingSignal[]> {
  const auth = await calendarService.getGoogleAuth();
  if (!auth) return [];

  const { google } = await import('googleapis');
  const calendar = google.calendar({ version: 'v3', auth });
  const response = await (calendar.events.list as any)({
    calendarId: 'primary',
    timeMin: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString(),
    timeMax: new Date().toISOString(),
    singleEvents: true,
    orderBy: 'startTime',
    maxResults: 50,
    conferenceDataVersion: 1,
    fields: 'items(id,summary,start,end,location,description,hangoutLink,conferenceData,updated)',
  });

  const items = Array.isArray(response?.data?.items) ? response.data.items : [];
  return items
    .filter((item: any) => hasGoogleMeetSignal(item))
    .map((item: any) => ({
      id: item.id || '',
      title: item.summary || 'Reunion sin titulo',
      start: item.start?.dateTime || item.start?.date || '',
      end: item.end?.dateTime || item.end?.date || '',
      meetUrl: item.hangoutLink || item.conferenceData?.entryPoints?.[0]?.uri || null,
      meetingCode: extractMeetingCode(`${item.summary || ''} ${item.hangoutLink || ''} ${item.conferenceData?.conferenceId || ''}`),
    }))
    .filter((item: CalendarMeetingSignal) => Boolean(item.id) && Boolean(item.end));
}

export async function fetchRecentTranscriptFiles(driveService: DriveService): Promise<DriveFile[]> {
  const since = new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString();
  const query = [
    `createdTime > '${since}'`,
    `mimeType = 'application/vnd.google-apps.document'`,
    `(name contains 'Transcript' or name contains 'transcrip' or name contains 'Registros de reuniones')`,
  ].join(' and ');
  const result = await driveService.listFiles({ query, maxResults: 50 });
  return result.success && result.files?.length ? result.files : [];
}
