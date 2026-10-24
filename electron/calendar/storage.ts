import { OAUTH_REDIRECT_URI } from './constants';
import { calendarSession } from './session-context';
import type { CalendarServiceCore } from './types';
import { createLogger } from '../utils/logger';

const log = createLogger('calendario-sesion');

export async function restoreGoogleSession(service: CalendarServiceCore): Promise<void> {
  const conn = service.connections.get('google');
  if (!conn?.isActive || !conn.refreshToken || !service.config.google?.clientId || !service.config.google?.clientSecret) return;
  const assert = calendarSession(service, conn);
  const identity = calendarSession(service);
  try {
    assert();
    const { google } = await import('googleapis');
    assert();
    const oauth2Client = new google.auth.OAuth2(service.config.google.clientId, service.config.google.clientSecret, OAUTH_REDIRECT_URI);
    oauth2Client.setCredentials({ refresh_token: conn.refreshToken });
    const { credentials } = await oauth2Client.refreshAccessToken();
    assert();
    if (!credentials.access_token) throw new Error('No se recibió una credencial vigente.');
    conn.accessToken = credentials.access_token;
    if (credentials.refresh_token) conn.refreshToken = credentials.refresh_token;
    if (credentials.expiry_date) conn.tokenExpiry = new Date(credentials.expiry_date);
    await service.saveConnections(assert);
    assert();
    service.emit('session-restored', { provider: 'google', email: conn.email });
    log.info('Sesión de calendario restaurada.');
  } catch {
    try { assert(); } catch { return; }
    conn.isActive = false;
    await service.saveConnections(identity).catch(() => log.warn('No se pudo persistir el estado de restauración.'));
    try { identity(); } catch { return; }
    if (service.connections.get('google') !== conn) return;
    service.emit('session-restore-failed', { provider: 'google', email: conn.email });
    log.warn('No se pudo restaurar la sesión de calendario.');
  }
}
