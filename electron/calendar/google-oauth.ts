import { OAUTH_REDIRECT_URI } from './constants';
import { openOAuthWindow } from './oauth-window';
import type { CalendarConnection, CalendarConnectionResult, CalendarServiceCore } from './types';
import { calendarSession } from './session-context';
import { CalendarStorageUnavailableError } from './credential-store';
import { createOAuthProof, validOAuthCode } from './oauth-proof';

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

export async function connectGoogle(service: CalendarServiceCore, beforeSave: () => void = () => {}, userId = service.userId): Promise<CalendarConnectionResult> {
  if (!service.config.google?.clientId || !service.config.google?.clientSecret) {
    return { success: false, error: 'Google OAuth no está configurado. Revisa VITE_GOOGLE_OAUTH_CLIENT_ID y VITE_GOOGLE_OAUTH_CLIENT_SECRET.' };
  }

  try {
    const config = service.config.google;
    const context = calendarSession(service);
    const assert = () => { context(); beforeSave(); if (userId !== service.userId || service.config.google !== config) throw new Error('El contexto de autorización cambió.'); };
    assert();
    const { google, Auth } = await import('googleapis');
    assert();
    const oauth2Client = new google.auth.OAuth2(
      config.clientId,
      config.clientSecret,
      OAUTH_REDIRECT_URI,
    );
    const proof = createOAuthProof();
    const authUrl = oauth2Client.generateAuthUrl({ access_type: 'offline', scope: GOOGLE_SCOPES, prompt: 'consent',
      state: proof.state, code_challenge: proof.challenge, code_challenge_method: Auth.CodeChallengeMethod.S256 });
    const code = await openOAuthWindow(authUrl, 'Google Calendar', { provider: 'google', clientId: config.clientId, proof, assertCurrent: assert });
    assert();
    if (!code) return { success: false, error: 'La autorización fue cancelada o venció.' };
    if (!validOAuthCode(code)) throw new Error('Código OAuth inválido.');

    const { tokens } = await oauth2Client.getToken({ code, codeVerifier: proof.verifier });
    assert();
    if (!tokens.access_token) throw new Error('No se recibió una autorización válida.');
    oauth2Client.setCredentials(tokens);
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const email = (await oauth2.userinfo.get()).data.email || '';
    const connection: CalendarConnection = {
      userId: userId || '',
      provider: 'google',
      email,
      accessToken: tokens.access_token || '',
      refreshToken: tokens.refresh_token || '',
      tokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : undefined,
      isActive: true,
    };

    assert();
    await service.setConnection(connection, assert);
    assert();
    service.emit('connected', { provider: 'google', email });
    assert();
    console.info('[Calendario] Cuenta de Google conectada.');
    return { success: true, email };
  } catch (error) {
    console.error('[Calendario] No se pudo conectar Google.');
    return { success: false, error: 'No se pudo conectar Google. Revisa la sesión y vuelve a intentarlo.',
      ...(error instanceof CalendarStorageUnavailableError ? { errorCode: 'secure_storage_unavailable' } : {}) };
  }
}
