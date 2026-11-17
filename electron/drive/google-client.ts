import type { CalendarService } from '../calendar-service';

export async function getDriveClient(calendarService: CalendarService) {
  const auth = await calendarService.getGoogleAuth();
  if (!auth) return null;

  const { google } = await import('../google-apis');
  return google.drive({ version: 'v3', auth });
}
