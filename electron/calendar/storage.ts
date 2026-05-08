import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { OAUTH_REDIRECT_URI } from './constants';
import type { CalendarConnection, CalendarServiceCore } from './types';

export function getStoragePath(): string {
  return path.join(app.getPath('userData'), 'calendar-connections.json');
}

export function loadConnections(service: CalendarServiceCore): void {
  try {
    if (!fs.existsSync(getStoragePath())) {
      console.log('[CalendarService] No saved connections found on disk.');
      return;
    }
    const loaded: CalendarConnection[] = JSON.parse(fs.readFileSync(getStoragePath(), 'utf-8'));
    for (const conn of Array.isArray(loaded) ? loaded : []) {
      if (conn.tokenExpiry) conn.tokenExpiry = new Date(conn.tokenExpiry);
      conn.isActive = true;
      service.connections.set(conn.provider, conn);
      service.emit('connected', { provider: conn.provider, email: conn.email });
      console.log(`[CalendarService] Loaded connection: ${conn.provider} (${conn.email})`);
    }
    if (loaded.length > 0) service.emit('connections-restored', { count: loaded.length });
  } catch {
    // Missing or invalid persistence is non-fatal.
  }
}

export function saveConnections(service: CalendarServiceCore): void {
  try {
    const conns = Array.from(service.connections.values()).map((connection) => ({
      ...connection,
      tokenExpiry: connection.tokenExpiry ? connection.tokenExpiry.toISOString() : undefined,
    }));
    fs.writeFileSync(getStoragePath(), JSON.stringify(conns, null, 2), 'utf-8');
    console.log(`[CalendarService] Connections saved to disk (${conns.length} connection(s))`);
  } catch (err: any) {
    console.error('[CalendarService] Error saving connections:', err.message);
  }
}

export async function restoreGoogleSession(service: CalendarServiceCore): Promise<void> {
  const conn = service.connections.get('google');
  if (!conn?.isActive || !conn.refreshToken) return;
  if (!service.config.google?.clientId || !service.config.google?.clientSecret) {
    console.warn('[CalendarService] Cannot restore Google session - OAuth config not set yet');
    return;
  }

  try {
    const { google } = await import('googleapis');
    const oauth2Client = new google.auth.OAuth2(
      service.config.google.clientId,
      service.config.google.clientSecret,
      OAUTH_REDIRECT_URI,
    );
    oauth2Client.setCredentials({ refresh_token: conn.refreshToken });
    const { credentials } = await oauth2Client.refreshAccessToken();
    if (!credentials.access_token) throw new Error('No access_token received from refresh');
    conn.accessToken = credentials.access_token;
    if (credentials.expiry_date) conn.tokenExpiry = new Date(credentials.expiry_date);
    service.saveConnections();
    service.emit('session-restored', { provider: 'google', email: conn.email });
    console.log(`[CalendarService] Google session restored successfully (${conn.email})`);
  } catch (err: any) {
    conn.isActive = false;
    service.saveConnections();
    service.emit('session-restore-failed', { provider: 'google', email: conn.email, error: err.message });
    console.error(`[CalendarService] Failed to restore Google session: ${err.message}`);
  }
}
