import { OAUTH_REDIRECT_URI } from './constants';
import type { CalendarServiceCore } from './types';
import { calendarSession } from './session-context';
import { createLogger } from '../utils/logger';

const log = createLogger('calendario-oauth');

export async function getGoogleAuth(service: CalendarServiceCore) {
  const conn = service.connections.get('google');
  if (!conn?.isActive || !service.userId || conn.userId !== service.userId) return null;
  const assert = calendarSession(service, conn);
  try {
    assert();
    const { google } = await import('googleapis');
    assert();
    const oauth2Client = new google.auth.OAuth2(service.config.google?.clientId, service.config.google?.clientSecret, OAUTH_REDIRECT_URI);
    // También protege clientes de Gmail/Drive/Chat conservados antes del logout.
    oauth2Client.transporter.interceptors.request.add({ resolved: async options => { assert(); return options; } });
    oauth2Client.transporter.interceptors.response.add({
      resolved: async response => { assert(); return response; },
      rejected: error => { assert(); throw error; },
    });
    oauth2Client.setCredentials({ access_token: conn.accessToken, refresh_token: conn.refreshToken, expiry_date: conn.tokenExpiry?.getTime() });
    oauth2Client.on('tokens', tokens => {
      if (!tokens.access_token) return;
      void (async () => {
        try {
          assert();
          conn.accessToken = tokens.access_token!;
          if (tokens.refresh_token) conn.refreshToken = tokens.refresh_token;
          if (tokens.expiry_date) conn.tokenExpiry = new Date(tokens.expiry_date);
          await service.saveConnections(assert);
          assert();
          service.emit('token-refreshed', { provider: 'google' });
          log.info('Credencial de calendario renovada y cifrada.');
        } catch {
          try { assert(); } catch { return; }
          log.warn('No se pudo persistir la renovación de calendario.');
        }
      })();
    });
    return oauth2Client;
  } catch {
    return null;
  }
}
