import type { BrowserWindow } from 'electron';
import type { CalendarService } from '../calendar-service';

export function registerCalendarEventForwarders(
  calendarService: CalendarService,
  getMainWindow: () => BrowserWindow | null,
): void {
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

  calendarService.on('session-restored', (data) => {
    getMainWindow()?.webContents.send('calendar:connected', data);
    console.log(`[CalendarHandlers] Session restored for ${data.provider} (${data.email})`);
  });

  calendarService.on('session-restore-failed', (data) => {
    getMainWindow()?.webContents.send('calendar:disconnected', data);
    console.log(`[CalendarHandlers] Session restore failed for ${data.provider}: ${data.error}`);
  });
}
