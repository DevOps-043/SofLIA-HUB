/**
 * CalendarHandlers — IPC handlers for calendar integration.
 */
import { ipcMain, type BrowserWindow } from 'electron';
import type { CalendarService } from './calendar-service';

export function registerCalendarHandlers(
  calendarService: CalendarService,
  getMainWindow: () => BrowserWindow | null
): void {
  // ─── Connect Google Calendar ──────────────────────────────────────
  ipcMain.handle('calendar:connect-google', async () => {
    return calendarService.connectGoogle();
  });

  // ─── Connect Microsoft Calendar ───────────────────────────────────
  ipcMain.handle('calendar:connect-microsoft', async () => {
    return calendarService.connectMicrosoft();
  });

  // ─── Disconnect provider ──────────────────────────────────────────
  ipcMain.handle('calendar:disconnect', async (_event, provider: 'google' | 'microsoft') => {
    calendarService.disconnect(provider);
    return { success: true };
  });

  // ─── Get current events ───────────────────────────────────────────
  ipcMain.handle('calendar:get-events', async () => {
    try {
      const events = await calendarService.getCurrentEvents();
      return { success: true, events };
    } catch (err: any) {
      return { success: false, error: err.message, events: [] };
    }
  });

  // ─── Get connections ──────────────────────────────────────────────
  ipcMain.handle('calendar:get-connections', async () => {
    return calendarService.getConnections().map(c => ({
      provider: c.provider,
      email: c.email,
      isActive: c.isActive,
    }));
  });

  // ─── Start auto-monitoring based on calendar ──────────────────────
  ipcMain.handle('calendar:start-auto', async () => {
    calendarService.startPolling();
    return { success: true };
  });

  // ─── Stop auto-monitoring ─────────────────────────────────────────
  ipcMain.handle('calendar:stop-auto', async () => {
    calendarService.stopPolling();
    return { success: true };
  });

  // ─── Get polling status ───────────────────────────────────────────
  ipcMain.handle('calendar:get-status', async () => {
    return calendarService.getPollingStatus();
  });

  // ─── Create event ───────────────────────────────────────────────
  ipcMain.handle('calendar:create-event', async (_event, eventData) => {
    try {
      return await calendarService.createEvent(eventData);
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // ─── Update event ──────────────────────────────────────────────
  ipcMain.handle('calendar:update-event', async (_event, eventId: string, updates) => {
    try {
      return await calendarService.updateEvent(eventId, updates);
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // ─── Delete event ──────────────────────────────────────────────
  ipcMain.handle('calendar:delete-event', async (_event, eventId: string, calendarId?: string) => {
    try {
      return await calendarService.deleteEvent(eventId, calendarId);
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // ─── Forward events to renderer ───────────────────────────────────
  calendarService.on('connected', (data) => {
    getMainWindow()?.webContents.send('calendar:connected', data);
  });

  calendarService.on('disconnected', (data) => {
    getMainWindow()?.webContents.send('calendar:disconnected', data);
  });

  calendarService.on('work-start', (data) => {
    getMainWindow()?.webContents.send('calendar:work-start', data);
  });

  calendarService.on('work-end', (data) => {
    getMainWindow()?.webContents.send('calendar:work-end', data);
  });

  calendarService.on('poll', (data) => {
    getMainWindow()?.webContents.send('calendar:poll', data);
  });

  calendarService.on('token-refreshed', (data) => {
    getMainWindow()?.webContents.send('calendar:token-refreshed', data);
  });

  console.log('[CalendarHandlers] Registered successfully');
}
