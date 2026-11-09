import type { BrowserWindow } from 'electron';
import type { CalendarService } from '../calendar-service';
import type { CalendarEvent } from './types';
import { getAuthState } from '../main/auth-state';
import { calendarEventDto, providerSchema } from './ipc-contract';

export function registerCalendarEventForwarders(service: CalendarService, getMainWindow: () => BrowserWindow | null): void {
  const send = (channel: string, value: unknown) => {
    const win = getMainWindow();
    const auth = getAuthState();
    if (auth.authenticated && auth.userId === service.userId && win && !win.isDestroyed()) win.webContents.send(channel, value);
  };
  const connection = (channel: string, value: unknown) => {
    const data = value as { provider?: unknown; email?: unknown } | null;
    const provider = providerSchema.safeParse(data?.provider);
    if (!provider.success) return;
    send(channel, { provider: provider.data, ...(typeof data?.email === 'string' ? { email: data.email.slice(0, 320) } : {}) });
  };
  service.on('connected', data => connection('calendar:connected', data));
  service.on('disconnected', data => connection('calendar:disconnected', data));
  service.on('session-restored', data => connection('calendar:connected', data));
  service.on('session-restore-failed', data => connection('calendar:disconnected', data));
  service.on('token-refreshed', data => {
    const provider = providerSchema.safeParse((data as { provider?: unknown } | null)?.provider);
    if (provider.success) send('calendar:token-refreshed', { provider: provider.data });
  });
  const work = (channel: string, value: { event?: CalendarEvent | null }) => send(channel, { event: calendarEventDto(value.event ?? null) });
  service.on('work-start', data => work('calendar:work-start', data));
  service.on('work-end', data => work('calendar:work-end', data));
  service.on('poll', (data: { events: CalendarEvent[]; inWorkHours: boolean; currentEvent: CalendarEvent | null; nextEvent: CalendarEvent | null }) => {
    send('calendar:poll', { events: data.events.map(event => calendarEventDto(event)), inWorkHours: data.inWorkHours,
      currentEvent: calendarEventDto(data.currentEvent), nextEvent: calendarEventDto(data.nextEvent) });
  });
}
