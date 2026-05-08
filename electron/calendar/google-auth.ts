import { OAUTH_REDIRECT_URI } from './constants';
import type { CalendarServiceCore } from './types';

export async function getGoogleAuth(service: CalendarServiceCore): Promise<any | null> {
  const conn = service.connections.get('google');
  if (!conn?.isActive) return null;

  const { google } = await import('googleapis');
  const oauth2Client = new google.auth.OAuth2(
    service.config.google?.clientId,
    service.config.google?.clientSecret,
    OAUTH_REDIRECT_URI,
  );
  oauth2Client.setCredentials({
    access_token: conn.accessToken,
    refresh_token: conn.refreshToken,
  });
  oauth2Client.on('tokens', (tokens: any) => {
    if (!tokens.access_token) return;
    conn.accessToken = tokens.access_token;
    if (tokens.expiry_date) conn.tokenExpiry = new Date(tokens.expiry_date);
    service.saveConnections();
    service.emit('token-refreshed', { provider: 'google', connection: conn });
    console.log('[CalendarService] Google token refreshed and saved to disk');
  });

  return oauth2Client;
}
