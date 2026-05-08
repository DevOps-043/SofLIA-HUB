import { EventEmitter } from 'node:events';
import { connectGoogle } from './google-oauth';
import { connectMicrosoft } from './microsoft-oauth';
import { getGoogleAuth as getGoogleAuthForService } from './google-auth';
import { createEvent as createGoogleEvent } from './event-writes';
import { deleteEvent as deleteGoogleEvent, updateEvent as updateGoogleEvent } from './event-updates';
import { getCurrentEvents as getCurrentCalendarEvents } from './event-queries';
import { startPolling as startCalendarPolling, stopPolling as stopCalendarPolling } from './polling';
import { loadConnections, restoreGoogleSession, saveConnections } from './storage';
import { checkWorkHours as checkCalendarWorkHours } from './work-hours';
import type { CalendarConfig, CalendarConnection, CalendarEvent, CalendarServiceCore } from './types';

export class CalendarService extends EventEmitter implements CalendarServiceCore {
  connections: Map<string, CalendarConnection> = new Map();
  pollingInterval: NodeJS.Timeout | null = null;
  config: CalendarConfig = {};
  userId: string | null = null;
  isInWorkHoursState = false;
  currentWorkEvent: CalendarEvent | null = null;

  async init(): Promise<void> { this.loadConnections(); await restoreGoogleSession(this); }
  loadConnections(): void { loadConnections(this); }
  saveConnections(): void { saveConnections(this); }
  setConfig(config: CalendarConfig): void { this.config = config; console.log('[CalendarService] Config set:', { google: !!config.google?.clientId, microsoft: !!config.microsoft?.clientId }); }
  setUserId(userId: string): void { this.userId = userId; }
  connectGoogle(): Promise<{ success: boolean; email?: string; error?: string }> { return connectGoogle(this); }
  connectMicrosoft(): Promise<{ success: boolean; email?: string; error?: string }> { return connectMicrosoft(this); }
  async disconnect(provider: 'google' | 'microsoft'): Promise<void> { this.connections.delete(provider); this.saveConnections(); this.emit('disconnected', { provider }); }
  getConnections(): CalendarConnection[] { return Array.from(this.connections.values()); }
  getCurrentEvents(targetDate?: Date): Promise<CalendarEvent[]> { return getCurrentCalendarEvents(this, targetDate); }
  checkWorkHours(events: CalendarEvent[]) { return checkCalendarWorkHours(events); }
  startPolling(intervalMs: number = 60000): void { startCalendarPolling(this, intervalMs); }
  stopPolling(): void { stopCalendarPolling(this); }
  getPollingStatus() { return { isPolling: this.pollingInterval !== null, inWorkHours: this.isInWorkHoursState, currentEvent: this.currentWorkEvent }; }
  getGoogleAuth(): Promise<any | null> { return getGoogleAuthForService(this); }
  createEvent(event: Parameters<typeof createGoogleEvent>[1]) { return createGoogleEvent(this, event); }
  updateEvent(eventId: string, updates: Parameters<typeof updateGoogleEvent>[2]) { return updateGoogleEvent(this, eventId, updates); }
  deleteEvent(eventId: string, calendarId?: string) { return deleteGoogleEvent(this, eventId, calendarId); }
}
