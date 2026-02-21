/**
 * CalendarService — Google Calendar & Microsoft Outlook integration.
 * Polls calendar events to detect work hours and auto-trigger monitoring.
 * Runs in the Electron main process.
 */
import { EventEmitter } from 'node:events';
import { BrowserWindow, app } from 'electron';
import http from 'node:http';
import { URL } from 'node:url';
import fs from 'node:fs/promises';
import path from 'node:path';

// ─── Types ──────────────────────────────────────────────────────────

export interface CalendarConnection {
  id?: string;
  userId: string;
  provider: 'google' | 'microsoft';
  email?: string;
  accessToken: string;
  refreshToken: string;
  tokenExpiry?: Date;
  calendarId?: string;
  isActive: boolean;
}

export interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  isAllDay: boolean;
  location?: string;
  description?: string;
  source: 'google' | 'microsoft';
}

export interface CalendarConfig {
  google?: {
    clientId: string;
    clientSecret: string;
  };
  microsoft?: {
    clientId: string;
  };
}

// ─── OAuth redirect port ────────────────────────────────────────────
// ─── Constants ──────────────────────────────────────────────────────
const OAUTH_REDIRECT_PORT = 8234;
const OAUTH_REDIRECT_URI = `http://localhost:${OAUTH_REDIRECT_PORT}/callback`;

// ─── CalendarService ────────────────────────────────────────────────

export class CalendarService extends EventEmitter {
  private connections: Map<string, CalendarConnection> = new Map(); // key: provider
  private pollingInterval: NodeJS.Timeout | null = null;
  private config: CalendarConfig = {};
  private userId: string | null = null;
  private isInWorkHoursState = false;
  private currentWorkEvent: CalendarEvent | null = null;

  constructor() {
    super();
  }

  // ─── Persistence ──────────────────────────────────────────────────
  private getStoragePath(): string {
    return path.join(app.getPath('userData'), 'calendar-connections.json');
  }

  async init(): Promise<void> {
    await this.loadConnections();
    // Proactively restore & refresh Google session so user doesn't need to re-auth
    await this.restoreGoogleSession();
  }

  /**
   * After loading saved connections, validate and refresh the Google token
   * so it's ready to use immediately without user interaction.
   */
  private async restoreGoogleSession(): Promise<void> {
    const conn = this.connections.get('google');
    if (!conn?.isActive || !conn.refreshToken) return;

    if (!this.config.google?.clientId || !this.config.google?.clientSecret) {
      console.warn('[CalendarService] Cannot restore Google session — OAuth config not set yet');
      return;
    }

    try {
      const { google } = await import('googleapis');
      const oauth2Client = new google.auth.OAuth2(
        this.config.google.clientId,
        this.config.google.clientSecret,
        OAUTH_REDIRECT_URI,
      );

      oauth2Client.setCredentials({
        refresh_token: conn.refreshToken,
      });

      // Force a token refresh to get a valid access_token
      const { credentials } = await oauth2Client.refreshAccessToken();

      if (credentials.access_token) {
        conn.accessToken = credentials.access_token;
        if (credentials.expiry_date) {
          conn.tokenExpiry = new Date(credentials.expiry_date);
        }
        // Persist the fresh token so next restart also works
        await this.saveConnections();
        console.log(`[CalendarService] Google session restored successfully (${conn.email})`);
        this.emit('session-restored', { provider: 'google', email: conn.email });
      } else {
        throw new Error('No access_token received from refresh');
      }
    } catch (err: any) {
      console.error(`[CalendarService] Failed to restore Google session: ${err.message}`);
      // Token might be revoked or expired beyond repair — mark inactive
      conn.isActive = false;
      await this.saveConnections();
      this.emit('session-restore-failed', { provider: 'google', email: conn.email, error: err.message });
    }
  }

  private async loadConnections(): Promise<void> {
    try {
      const data = await fs.readFile(this.getStoragePath(), 'utf-8');
      const loaded: CalendarConnection[] = JSON.parse(data);
      for (const conn of loaded) {
        if (conn.tokenExpiry) {
          conn.tokenExpiry = new Date(conn.tokenExpiry);
        }
        this.connections.set(conn.provider, conn);
        this.emit('connected', { provider: conn.provider, email: conn.email });
        console.log(`[CalendarService] Automatically loaded connection: ${conn.provider} (${conn.email})`);
      }
    } catch {
      // File does not exist or invalid, ignore
    }
  }

  private async saveConnections(): Promise<void> {
    try {
      const arr = Array.from(this.connections.values());
      await fs.writeFile(this.getStoragePath(), JSON.stringify(arr, null, 2), 'utf-8');
    } catch (err: any) {
      console.error('[CalendarService] Error saving connections:', err.message);
    }
  }

  // ─── Configuration ────────────────────────────────────────────────

  setConfig(config: CalendarConfig): void {
    this.config = config;
    console.log('[CalendarService] Config set:', {
      google: !!config.google?.clientId,
      microsoft: !!config.microsoft?.clientId,
    });
  }

  setUserId(userId: string): void {
    this.userId = userId;
  }

  // ─── Google OAuth ─────────────────────────────────────────────────

  async connectGoogle(): Promise<{ success: boolean; email?: string; error?: string }> {
    if (!this.config.google?.clientId || !this.config.google?.clientSecret) {
      return { success: false, error: 'Google OAuth credentials not configured. Set VITE_GOOGLE_OAUTH_CLIENT_ID and VITE_GOOGLE_OAUTH_CLIENT_SECRET in .env' };
    }

    try {
      const { google } = await import('googleapis');
      const oauth2Client = new google.auth.OAuth2(
        this.config.google.clientId,
        this.config.google.clientSecret,
        OAUTH_REDIRECT_URI,
      );

      const authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: [
          'https://www.googleapis.com/auth/calendar.events',
          'https://www.googleapis.com/auth/calendar.events.readonly',
          'https://www.googleapis.com/auth/gmail.send',
          'https://www.googleapis.com/auth/gmail.modify',
          'https://www.googleapis.com/auth/drive',
          'https://www.googleapis.com/auth/drive.file',
          'https://www.googleapis.com/auth/userinfo.email',
        ],
        prompt: 'consent',
      });

      // Get auth code via browser window + local HTTP server
      const code = await this.openOAuthWindow(authUrl, 'Google Calendar');
      if (!code) return { success: false, error: 'OAuth flow cancelled' };

      // Exchange code for tokens
      const { tokens } = await oauth2Client.getToken(code);
      oauth2Client.setCredentials(tokens);

      // Get user email
      const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
      const userInfo = await oauth2.userinfo.get();
      const email = userInfo.data.email || '';

      const connection: CalendarConnection = {
        userId: this.userId || '',
        provider: 'google',
        email,
        accessToken: tokens.access_token || '',
        refreshToken: tokens.refresh_token || '',
        tokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : undefined,
        isActive: true,
      };

      this.connections.set('google', connection);
      await this.saveConnections();
      this.emit('connected', { provider: 'google', email });
      console.log(`[CalendarService] Google connected: ${email}`);
      return { success: true, email };
    } catch (err: any) {
      console.error('[CalendarService] Google OAuth error:', err.message);
      return { success: false, error: err.message };
    }
  }

  // ─── Microsoft OAuth ──────────────────────────────────────────────

  async connectMicrosoft(): Promise<{ success: boolean; email?: string; error?: string }> {
    if (!this.config.microsoft?.clientId) {
      return { success: false, error: 'Microsoft OAuth credentials not configured. Set VITE_MICROSOFT_CLIENT_ID in .env' };
    }

    try {
      const { ConfidentialClientApplication } = await import('@azure/msal-node');

      const msalConfig = {
        auth: {
          clientId: this.config.microsoft.clientId,
          authority: 'https://login.microsoftonline.com/common',
        },
      };

      const cca = new ConfidentialClientApplication(msalConfig as any);

      const authUrl = await cca.getAuthCodeUrl({
        scopes: ['Calendars.Read', 'User.Read'],
        redirectUri: OAUTH_REDIRECT_URI,
      });

      const code = await this.openOAuthWindow(authUrl, 'Microsoft Calendar');
      if (!code) return { success: false, error: 'OAuth flow cancelled' };

      const tokenResult = await cca.acquireTokenByCode({
        code,
        scopes: ['Calendars.Read', 'User.Read'],
        redirectUri: OAUTH_REDIRECT_URI,
      });

      const connection: CalendarConnection = {
        userId: this.userId || '',
        provider: 'microsoft',
        email: tokenResult.account?.username || '',
        accessToken: tokenResult.accessToken,
        refreshToken: '', // MSAL handles refresh internally
        tokenExpiry: tokenResult.expiresOn || undefined,
        isActive: true,
      };

      this.connections.set('microsoft', connection);
      await this.saveConnections();
      this.emit('connected', { provider: 'microsoft', email: connection.email });
      console.log(`[CalendarService] Microsoft connected: ${connection.email}`);
      return { success: true, email: connection.email };
    } catch (err: any) {
      console.error('[CalendarService] Microsoft OAuth error:', err.message);
      return { success: false, error: err.message };
    }
  }

  // ─── Disconnect ───────────────────────────────────────────────────

  async disconnect(provider: 'google' | 'microsoft'): Promise<void> {
    this.connections.delete(provider);
    await this.saveConnections();
    this.emit('disconnected', { provider });
    console.log(`[CalendarService] Disconnected: ${provider}`);
  }

  // ─── Load saved connections ───────────────────────────────────────

  loadConnection(conn: CalendarConnection): void {
    this.connections.set(conn.provider, conn);
    console.log(`[CalendarService] Loaded connection: ${conn.provider} (${conn.email})`);
  }

  // ─── Get connections ──────────────────────────────────────────────

  getConnections(): CalendarConnection[] {
    return Array.from(this.connections.values());
  }

  // ─── Fetch current events ─────────────────────────────────────────

  async getEventsRange(start: Date, end: Date): Promise<CalendarEvent[]> {
    const events: CalendarEvent[] = [];

    // Google events
    const googleConn = this.connections.get('google');
    if (googleConn?.isActive) {
      try {
        const googleEvents = await this.fetchGoogleEvents(googleConn, start, end);
        events.push(...googleEvents);
      } catch (err: any) {
        console.error('[CalendarService] Google fetch error:', err.message);
      }
    }

    // Microsoft events
    const microsoftConn = this.connections.get('microsoft');
    if (microsoftConn?.isActive) {
      try {
        const msEvents = await this.fetchMicrosoftEvents(microsoftConn, start, end);
        events.push(...msEvents);
      } catch (err: any) {
        console.error('[CalendarService] Microsoft fetch error:', err.message);
      }
    }

    return events.sort((a, b) => a.start.getTime() - b.start.getTime());
  }

  async getCurrentEvents(): Promise<CalendarEvent[]> {
    const now = new Date();
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);
    return this.getEventsRange(now, endOfDay);
  }

  // ─── Work hours detection ─────────────────────────────────────────

  checkWorkHours(events: CalendarEvent[]): { inWorkHours: boolean; currentEvent: CalendarEvent | null; nextEvent: CalendarEvent | null } {
    const now = new Date();
    let currentEvent: CalendarEvent | null = null;
    let nextEvent: CalendarEvent | null = null;

    for (const event of events) {
      if (event.isAllDay) continue; // Skip all-day events
      if (now >= event.start && now <= event.end) {
        currentEvent = event;
      } else if (now < event.start && !nextEvent) {
        nextEvent = event;
      }
    }

    return {
      inWorkHours: currentEvent !== null,
      currentEvent,
      nextEvent,
    };
  }

  // ─── Polling: Auto-detect work hours ──────────────────────────────

  startPolling(intervalMs: number = 60000): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
    }

    console.log(`[CalendarService] Polling started (every ${intervalMs / 1000}s)`);

    const poll = async () => {
      try {
        const events = await this.getCurrentEvents();
        const { inWorkHours, currentEvent, nextEvent } = this.checkWorkHours(events);

        // Emit state changes
        if (inWorkHours && !this.isInWorkHoursState) {
          this.isInWorkHoursState = true;
          this.currentWorkEvent = currentEvent;
          this.emit('work-start', { event: currentEvent });
          console.log(`[CalendarService] Work started: ${currentEvent?.title}`);
        } else if (!inWorkHours && this.isInWorkHoursState) {
          this.isInWorkHoursState = false;
          const endedEvent = this.currentWorkEvent;
          this.currentWorkEvent = null;
          this.emit('work-end', { event: endedEvent });
          console.log(`[CalendarService] Work ended`);
        }

        this.emit('poll', { events, inWorkHours, currentEvent, nextEvent });
      } catch (err: any) {
        console.error('[CalendarService] Poll error:', err.message);
      }
    };

    // Poll immediately, then at interval
    poll();
    this.pollingInterval = setInterval(poll, intervalMs);
  }

  stopPolling(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
    this.isInWorkHoursState = false;
    this.currentWorkEvent = null;
    console.log('[CalendarService] Polling stopped');
  }

  getPollingStatus(): { isPolling: boolean; inWorkHours: boolean; currentEvent: CalendarEvent | null } {
    return {
      isPolling: this.pollingInterval !== null,
      inWorkHours: this.isInWorkHoursState,
      currentEvent: this.currentWorkEvent,
    };
  }

  // ─── Public: Shared Google OAuth2 client ──────────────────────────

  async getGoogleAuth(): Promise<any | null> {
    const conn = this.connections.get('google');
    if (!conn?.isActive) return null;

    const { google } = await import('googleapis');
    const oauth2Client = new google.auth.OAuth2(
      this.config.google?.clientId,
      this.config.google?.clientSecret,
      OAUTH_REDIRECT_URI,
    );
    oauth2Client.setCredentials({
      access_token: conn.accessToken,
      refresh_token: conn.refreshToken,
    });

    // Keep tokens in sync
    oauth2Client.on('tokens', async (tokens: any) => {
      if (tokens.access_token) {
        conn.accessToken = tokens.access_token;
        if (tokens.expiry_date) conn.tokenExpiry = new Date(tokens.expiry_date);
        await this.saveConnections();
        this.emit('token-refreshed', { provider: 'google', connection: conn });
      }
    });

    return oauth2Client;
  }

  // ─── Calendar Write Operations ──────────────────────────────────

  async createEvent(event: {
    title: string;
    start: Date;
    end: Date;
    description?: string;
    location?: string;
    calendarId?: string;
  }): Promise<{ success: boolean; eventId?: string; error?: string }> {
    const auth = await this.getGoogleAuth();
    if (!auth) return { success: false, error: 'Google no conectado' };

    try {
      const { google } = await import('googleapis');
      const calendar = google.calendar({ version: 'v3', auth });
      const response = await calendar.events.insert({
        calendarId: event.calendarId || 'primary',
        requestBody: {
          summary: event.title,
          description: event.description,
          location: event.location,
          start: { dateTime: event.start.toISOString() },
          end: { dateTime: event.end.toISOString() },
        },
      });
      console.log(`[CalendarService] Event created: ${response.data.id}`);
      return { success: true, eventId: response.data.id || undefined };
    } catch (err: any) {
      console.error('[CalendarService] Create event error:', err.message);
      return { success: false, error: err.message };
    }
  }

  async updateEvent(
    eventId: string,
    updates: {
      title?: string;
      start?: Date;
      end?: Date;
      description?: string;
      location?: string;
      calendarId?: string;
    },
  ): Promise<{ success: boolean; error?: string }> {
    const auth = await this.getGoogleAuth();
    if (!auth) return { success: false, error: 'Google no conectado' };

    try {
      const { google } = await import('googleapis');
      const calendar = google.calendar({ version: 'v3', auth });
      const requestBody: any = {};
      if (updates.title) requestBody.summary = updates.title;
      if (updates.description !== undefined) requestBody.description = updates.description;
      if (updates.location !== undefined) requestBody.location = updates.location;
      if (updates.start) requestBody.start = { dateTime: updates.start.toISOString() };
      if (updates.end) requestBody.end = { dateTime: updates.end.toISOString() };

      await calendar.events.patch({
        calendarId: updates.calendarId || 'primary',
        eventId,
        requestBody,
      });
      console.log(`[CalendarService] Event updated: ${eventId}`);
      return { success: true };
    } catch (err: any) {
      console.error('[CalendarService] Update event error:', err.message);
      return { success: false, error: err.message };
    }
  }

  async deleteEvent(
    eventId: string,
    calendarId?: string,
  ): Promise<{ success: boolean; error?: string }> {
    const auth = await this.getGoogleAuth();
    if (!auth) return { success: false, error: 'Google no conectado' };

    try {
      const { google } = await import('googleapis');
      const calendar = google.calendar({ version: 'v3', auth });
      await calendar.events.delete({
        calendarId: calendarId || 'primary',
        eventId,
      });
      console.log(`[CalendarService] Event deleted: ${eventId}`);
      return { success: true };
    } catch (err: any) {
      console.error('[CalendarService] Delete event error:', err.message);
      return { success: false, error: err.message };
    }
  }

  // ─── Private: Google Calendar API ─────────────────────────────────

  private async fetchGoogleEvents(conn: CalendarConnection, start: Date, end: Date): Promise<CalendarEvent[]> {
    const { google } = await import('googleapis');
    const oauth2Client = new google.auth.OAuth2(
      this.config.google?.clientId,
      this.config.google?.clientSecret,
    );
    oauth2Client.setCredentials({
      access_token: conn.accessToken,
      refresh_token: conn.refreshToken,
    });

    // Handle token refresh
    oauth2Client.on('tokens', async (tokens) => {
      if (tokens.access_token) {
        conn.accessToken = tokens.access_token;
        if (tokens.expiry_date) conn.tokenExpiry = new Date(tokens.expiry_date);
        await this.saveConnections();
        this.emit('token-refreshed', { provider: 'google', connection: conn });
      }
    });

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    const response = await calendar.events.list({
      calendarId: conn.calendarId || 'primary',
      timeMin: start.toISOString(),
      timeMax: end.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: 20,
    });

    return (response.data.items || []).map((item) => ({
      id: item.id || '',
      title: item.summary || 'Sin título',
      start: new Date(item.start?.dateTime || item.start?.date || ''),
      end: new Date(item.end?.dateTime || item.end?.date || ''),
      isAllDay: !item.start?.dateTime,
      location: item.location || undefined,
      description: item.description || undefined,
      source: 'google' as const,
    }));
  }

  // ─── Private: Microsoft Graph Calendar API ────────────────────────

  private async fetchMicrosoftEvents(conn: CalendarConnection, start: Date, end: Date): Promise<CalendarEvent[]> {
    const { Client } = await import('@microsoft/microsoft-graph-client');

    const client = Client.init({
      authProvider: (done) => {
        done(null, conn.accessToken);
      },
    });

    const response = await client
      .api('/me/calendarview')
      .query({
        startDateTime: start.toISOString(),
        endDateTime: end.toISOString(),
      })
      .select('id,subject,start,end,isAllDay,location,body')
      .orderby('start/dateTime')
      .top(20)
      .get();

    return (response.value || []).map((item: any) => ({
      id: item.id || '',
      title: item.subject || 'Sin título',
      start: new Date(item.start?.dateTime + 'Z'),
      end: new Date(item.end?.dateTime + 'Z'),
      isAllDay: item.isAllDay || false,
      location: item.location?.displayName || undefined,
      description: item.body?.content || undefined,
      source: 'microsoft' as const,
    }));
  }

  // ─── Private: OAuth Browser Window ────────────────────────────────

  private openOAuthWindow(authUrl: string, title: string): Promise<string | null> {
    return new Promise((resolve) => {
      let resolved = false;
      let server: http.Server | null = null;

      // Create a temporary HTTP server to catch the redirect
      server = http.createServer((req, res) => {
        const url = new URL(req.url || '', `http://localhost:${OAUTH_REDIRECT_PORT}`);
        const code = url.searchParams.get('code');

        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`
          <html><body style="font-family:system-ui;text-align:center;padding:60px;background:#1a1a2e;color:white">
            <h2>${code ? 'Conectado exitosamente' : 'Error de conexión'}</h2>
            <p>${code ? 'Puedes cerrar esta ventana.' : 'No se pudo obtener autorización.'}</p>
            <script>setTimeout(() => window.close(), 2000)</script>
          </body></html>
        `);

        if (!resolved) {
          resolved = true;
          resolve(code || null);
        }

        // Close server after response
        setTimeout(() => {
          server?.close();
          authWin?.close();
        }, 1000);
      });

      server.listen(OAUTH_REDIRECT_PORT, '127.0.0.1');

      // Open browser window for OAuth
      const authWin = new BrowserWindow({
        width: 600,
        height: 700,
        title: `Conectar ${title}`,
        webPreferences: { nodeIntegration: false, contextIsolation: true },
      });

      authWin.loadURL(authUrl);

      authWin.on('closed', () => {
        if (!resolved) {
          resolved = true;
          resolve(null);
          server?.close();
        }
      });

      // Timeout after 5 minutes
      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          resolve(null);
          server?.close();
          authWin?.close();
        }
      }, 300000);
    });
  }
}
