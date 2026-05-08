import { ipcMain, type BrowserWindow } from 'electron';
import { registerCalendarEventForwarders } from './calendar/event-forwarder';
import type { CalendarService } from './calendar-service';

export function registerCalendarHandlers(
  calendarService: CalendarService,
  getMainWindow: () => BrowserWindow | null,
): void {
  ipcMain.handle('calendar:connect-google', async () => calendarService.connectGoogle());
  ipcMain.handle('calendar:connect-microsoft', async () => calendarService.connectMicrosoft());

  ipcMain.handle('calendar:disconnect', async (_event, provider: 'google' | 'microsoft') => {
    calendarService.disconnect(provider);
    return { success: true };
  });

  ipcMain.handle('calendar:get-events', async () => {
    try {
      const events = await calendarService.getCurrentEvents();
      return { success: true, events };
    } catch (err: any) {
      return { success: false, error: err.message, events: [] };
    }
  });

  ipcMain.handle('calendar:get-connections', async () => {
    return calendarService.getConnections().map((connection) => ({
      provider: connection.provider,
      email: connection.email,
      isActive: connection.isActive,
    }));
  });

  ipcMain.handle('calendar:start-auto', async () => {
    calendarService.startPolling();
    return { success: true };
  });

  ipcMain.handle('calendar:stop-auto', async () => {
    calendarService.stopPolling();
    return { success: true };
  });

  ipcMain.handle('calendar:get-status', async () => calendarService.getPollingStatus());

  ipcMain.handle('calendar:create-event', async (_event, eventData) => {
    try {
      return await calendarService.createEvent(eventData);
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('calendar:update-event', async (_event, eventId: string, updates) => {
    try {
      return await calendarService.updateEvent(eventId, updates);
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('calendar:delete-event', async (_event, eventId: string, calendarId?: string) => {
    try {
      return await calendarService.deleteEvent(eventId, calendarId);
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  registerCalendarEventForwarders(calendarService, getMainWindow);
  console.log('[CalendarHandlers] Registered successfully');
}
