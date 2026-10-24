import { OAUTH_REDIRECT_URI } from './constants';
import { openOAuthWindow } from './oauth-window';
import type { CalendarConnection, CalendarConnectionResult, CalendarServiceCore } from './types';
import { calendarSession } from './session-context';
import { CalendarStorageUnavailableError } from './credential-store';

export async function connectMicrosoft(service: CalendarServiceCore, beforeSave: () => void = () => {}, userId = service.userId): Promise<CalendarConnectionResult> {
  if (!service.config.microsoft?.clientId) {
    return { success: false, error: 'Microsoft OAuth credentials not configured. Set VITE_MICROSOFT_CLIENT_ID in .env' };
  }

  try {
    const context = calendarSession(service);
    const assert = () => { context(); beforeSave(); if (userId !== service.userId) throw new Error('Propietario incorrecto.'); };
    assert();
    const { ConfidentialClientApplication } = await import('@azure/msal-node');
    assert();
    const cca = new ConfidentialClientApplication({
      auth: {
        clientId: service.config.microsoft.clientId,
        authority: 'https://login.microsoftonline.com/common',
      },
    });
    const authUrl = await cca.getAuthCodeUrl({
      scopes: ['Calendars.Read', 'User.Read'],
      redirectUri: OAUTH_REDIRECT_URI,
    });
    assert();
    const code = await openOAuthWindow(authUrl, 'Microsoft Calendar');
    assert();
    if (!code) return { success: false, error: 'OAuth flow cancelled' };

    const tokenResult = await cca.acquireTokenByCode({
      code,
      scopes: ['Calendars.Read', 'User.Read'],
      redirectUri: OAUTH_REDIRECT_URI,
    });
    const connection: CalendarConnection = {
      userId: userId || '',
      provider: 'microsoft',
      email: tokenResult.account?.username || '',
      accessToken: tokenResult.accessToken,
      refreshToken: '',
      tokenExpiry: tokenResult.expiresOn || undefined,
      isActive: true,
    };

    assert();
    await service.setConnection(connection, assert);
    assert();
    service.emit('connected', { provider: 'microsoft', email: connection.email });
    assert();
    console.info('[Calendario] Cuenta de Microsoft conectada.');
    return { success: true, email: connection.email };
  } catch (error) {
    console.error('[Calendario] No se pudo conectar Microsoft.');
    return { success: false, error: 'No se pudo conectar Microsoft. Revisa la sesión y vuelve a intentarlo.',
      ...(error instanceof CalendarStorageUnavailableError ? { errorCode: 'secure_storage_unavailable' } : {}) };
  }
}
