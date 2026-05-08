import { OAUTH_REDIRECT_URI } from './constants';
import { openOAuthWindow } from './oauth-window';
import type { CalendarConnection, CalendarServiceCore } from './types';

export async function connectMicrosoft(service: CalendarServiceCore) {
  if (!service.config.microsoft?.clientId) {
    return { success: false, error: 'Microsoft OAuth credentials not configured. Set VITE_MICROSOFT_CLIENT_ID in .env' };
  }

  try {
    const { ConfidentialClientApplication } = await import('@azure/msal-node');
    const cca = new ConfidentialClientApplication({
      auth: {
        clientId: service.config.microsoft.clientId,
        authority: 'https://login.microsoftonline.com/common',
      },
    } as any);
    const authUrl = await cca.getAuthCodeUrl({
      scopes: ['Calendars.Read', 'User.Read'],
      redirectUri: OAUTH_REDIRECT_URI,
    });
    const code = await openOAuthWindow(authUrl, 'Microsoft Calendar');
    if (!code) return { success: false, error: 'OAuth flow cancelled' };

    const tokenResult = await cca.acquireTokenByCode({
      code,
      scopes: ['Calendars.Read', 'User.Read'],
      redirectUri: OAUTH_REDIRECT_URI,
    });
    const connection: CalendarConnection = {
      userId: service.userId || '',
      provider: 'microsoft',
      email: tokenResult.account?.username || '',
      accessToken: tokenResult.accessToken,
      refreshToken: '',
      tokenExpiry: tokenResult.expiresOn || undefined,
      isActive: true,
    };

    service.connections.set('microsoft', connection);
    service.saveConnections();
    service.emit('connected', { provider: 'microsoft', email: connection.email });
    console.log(`[CalendarService] Microsoft connected: ${connection.email}`);
    return { success: true, email: connection.email };
  } catch (err: any) {
    console.error('[CalendarService] Microsoft OAuth error:', err.message);
    return { success: false, error: err.message };
  }
}
