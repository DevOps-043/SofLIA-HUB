import type { CalendarService } from '../calendar-service';
import type { GmailClient } from './types';

export async function createGmailClient(
  calendarService: CalendarService,
): Promise<{ client?: GmailClient; error?: string }> {
  const auth = await calendarService.getGoogleAuth();
  if (!auth) return { error: 'Google no conectado' };

  const { google } = await import('googleapis');
  return { client: google.gmail({ version: 'v1', auth }) as GmailClient };
}
