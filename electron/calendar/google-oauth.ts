import { OAUTH_REDIRECT_URI } from './constants';
import { openOAuthWindow } from './oauth-window';
import type { CalendarConnection, CalendarServiceCore } from './types';

const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar.events.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/gmail.compose',
  'https://www.googleapis.com/auth/gmail.labels',
  'https://www.googleapis.com/auth/gmail.settings.basic',
  'https://www.googleapis.com/auth/gmail.insert',
  'https://www.googleapis.com/auth/gmail.addons.current.message.action',
  'https://www.googleapis.com/auth/gmail.addons.current.action.compose',
  'https://mail.google.com/',
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/drive.install',
  'https://www.googleapis.com/auth/drive.metadata.readonly',
  'https://www.googleapis.com/auth/drive.activity',
  'https://www.googleapis.com/auth/drive.activity.readonly',
  'https://www.googleapis.com/auth/drive.photos.readonly',
  'https://www.googleapis.com/auth/drive.meet.readonly',
  'https://www.googleapis.com/auth/drive.appdata',
  'https://www.googleapis.com/auth/docs',
  'https://www.googleapis.com/auth/chat.spaces.readonly',
  'https://www.googleapis.com/auth/chat.messages',
  'https://www.googleapis.com/auth/chat.messages.readonly',
  'https://www.googleapis.com/auth/chat.messages.create',
  'https://www.googleapis.com/auth/chat.messages.reactions',
  'https://www.googleapis.com/auth/chat.messages.reactions.create',
  'https://www.googleapis.com/auth/chat.memberships.readonly',
  'https://www.googleapis.com/auth/chat.users.readstate',
  'https://www.googleapis.com/auth/chat.users.availability',
  'https://www.googleapis.com/auth/chat.users.availability.readonly',
  'https://www.googleapis.com/auth/chat.admin.memberships.readonly',
  'https://www.googleapis.com/auth/calendar.freebusy',
  'https://www.googleapis.com/auth/meetings.space.created',
  'https://www.googleapis.com/auth/meetings.space.readonly',
  'https://www.googleapis.com/auth/meetings.space.settings',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/activity',
];

export async function connectGoogle(service: CalendarServiceCore) {
  if (!service.config.google?.clientId || !service.config.google?.clientSecret) {
    return { success: false, error: 'Google OAuth credentials not configured. Set VITE_GOOGLE_OAUTH_CLIENT_ID and VITE_GOOGLE_OAUTH_CLIENT_SECRET in .env' };
  }

  try {
    const { google } = await import('googleapis');
    const oauth2Client = new google.auth.OAuth2(
      service.config.google.clientId,
      service.config.google.clientSecret,
      OAUTH_REDIRECT_URI,
    );
    const authUrl = oauth2Client.generateAuthUrl({ access_type: 'offline', scope: GOOGLE_SCOPES, prompt: 'consent' });
    const code = await openOAuthWindow(authUrl, 'Google Calendar');
    if (!code) return { success: false, error: 'OAuth flow cancelled' };

    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const email = (await oauth2.userinfo.get()).data.email || '';
    const connection: CalendarConnection = {
      userId: service.userId || '',
      provider: 'google',
      email,
      accessToken: tokens.access_token || '',
      refreshToken: tokens.refresh_token || '',
      tokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : undefined,
      isActive: true,
    };

    service.connections.set('google', connection);
    service.saveConnections();
    service.emit('connected', { provider: 'google', email });
    console.log(`[CalendarService] Google connected: ${email}`);
    return { success: true, email };
  } catch (err: any) {
    console.error('[CalendarService] Google OAuth error:', err.message);
    return { success: false, error: err.message };
  }
}
