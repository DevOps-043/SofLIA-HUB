import { OAUTH_REDIRECT_URI } from './constants';
import { openOAuthWindow } from './oauth-window';
import type { CalendarConnection, CalendarConnectionResult, CalendarServiceCore } from './types';
import { calendarSession } from './session-context';
import { CalendarStorageUnavailableError } from './credential-store';
import { randomBytes } from 'node:crypto';
import { createOAuthProof, validOAuthCode } from './oauth-proof';

export async function connectMicrosoft(service: CalendarServiceCore, beforeSave: () => void = () => {}, userId = service.userId): Promise<CalendarConnectionResult> {
  if (!service.config.microsoft?.clientId) {
    return { success: false, error: 'Microsoft OAuth no está configurado. Revisa VITE_MICROSOFT_CLIENT_ID.' };
  }

  try {
    const config = service.config.microsoft;
    const context = calendarSession(service);
    const assert = () => { context(); beforeSave(); if (userId !== service.userId || service.config.microsoft !== config) throw new Error('El contexto de autorización cambió.'); };
    assert();
    const { PublicClientApplication, ResponseMode } = await import('@azure/msal-node');
    assert();
    const proof = createOAuthProof();
    const nonce = randomBytes(32).toString('base64url');
    const client = new PublicClientApplication({
      auth: {
        clientId: config.clientId,
        authority: 'https://login.microsoftonline.com/common',
      },
      system: { loggerOptions: { piiLoggingEnabled: false, loggerCallback: () => {} } },
    });
    const authUrl = await client.getAuthCodeUrl({
      scopes: ['Calendars.Read', 'User.Read'],
      redirectUri: OAUTH_REDIRECT_URI,
      state: proof.state, nonce, codeChallenge: proof.challenge, codeChallengeMethod: 'S256', responseMode: ResponseMode.QUERY,
    });
    assert();
    const code = await openOAuthWindow(authUrl, 'Microsoft Calendar', { provider: 'microsoft', clientId: config.clientId, proof, assertCurrent: assert });
    assert();
    if (!code) return { success: false, error: 'La autorización fue cancelada o venció.' };
    if (!validOAuthCode(code)) throw new Error('Código OAuth inválido.');

    const tokenResult = await client.acquireTokenByCode({
      code,
      scopes: ['Calendars.Read', 'User.Read'],
      redirectUri: OAUTH_REDIRECT_URI,
      codeVerifier: proof.verifier, nonce, state: proof.state,
    });
    assert();
    if (!tokenResult.accessToken) throw new Error('No se recibió una autorización válida.');
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
