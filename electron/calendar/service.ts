import { EventEmitter } from 'node:events';
import { connectGoogle } from './google-oauth';
import { connectMicrosoft } from './microsoft-oauth';
import { getGoogleAuth as getGoogleAuthForService } from './google-auth';
import { createEvent as createGoogleEvent } from './event-writes';
import { deleteEvent as deleteGoogleEvent, updateEvent as updateGoogleEvent } from './event-updates';
import { getCurrentEvents as getCurrentCalendarEvents } from './event-queries';
import { startPolling as startCalendarPolling, stopPolling as stopCalendarPolling } from './polling';
import { restoreGoogleSession } from './storage';
import { CalendarCredentialStore } from './credential-store';
import { calendarSession } from './session-context';
import { getAuthState, onAuthStateChange } from '../main/auth-state';
import { createLogger } from '../utils/logger';
import { checkWorkHours as checkCalendarWorkHours } from './work-hours';
import type { CalendarConfig, CalendarConnection, CalendarEvent, CalendarServiceCore } from './types';

const log = createLogger('calendario');
type CredentialStore = Pick<CalendarCredentialStore, 'load' | 'save'>;

export class CalendarService extends EventEmitter implements CalendarServiceCore {
  connections: Map<string, CalendarConnection> = new Map();
  pollingInterval: NodeJS.Timeout | null = null;
  config: CalendarConfig = {};
  userId: string | null = null;
  contextRevision = 0;
  isInWorkHoursState = false;
  currentWorkEvent: CalendarEvent | null = null;
  private unsubscribe: (() => void) | null = null;
  private queue: Promise<unknown> = Promise.resolve();
  private sessionTask: Promise<void> = Promise.resolve();

  constructor(private readonly credentials: CredentialStore = new CalendarCredentialStore()) { super(); }
  private serialize<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.queue.then(operation); this.queue = result.catch(() => {}); return result;
  }
  async init(): Promise<void> {
    if (this.unsubscribe) return this.sessionTask;
    const activate = () => {
      const state = getAuthState();
      this.sessionTask = this.activateUser(state.authenticated ? state.userId : null).catch(() => log.warn('No se pudo cargar la custodia del calendario.'));
      return this.sessionTask;
    };
    this.unsubscribe = onAuthStateChange(activate);
    await activate();
  }
  private async activateUser(userId: string | null): Promise<void> {
    this.setUserId(userId);
    if (!userId) return;
    const assert = calendarSession(this);
    await this.loadConnections(); assert(); await restoreGoogleSession(this);
  }
  loadConnections(): Promise<void> {
    const assert = calendarSession(this); const owner = this.userId;
    return this.serialize(async () => {
      assert();
      const connections = await this.credentials.load(owner!, assert);
      assert();
      this.connections = new Map(connections.map(connection => [connection.provider, connection]));
      for (const connection of connections) {
        assert();
        if (connection.isActive) this.emit('connected', { provider: connection.provider, email: connection.email });
      }
      assert();
      if (connections.length) this.emit('connections-restored', { count: connections.length });
    });
  }
  saveConnections(assert = calendarSession(this)): Promise<void> {
    const owner = this.userId;
    return this.serialize(async () => { assert(); await this.credentials.save(owner!, this.getConnections(), assert); assert(); });
  }
  setConnection(connection: CalendarConnection, assert: () => void): Promise<void> {
    const context = calendarSession(this);
    const check = () => { context(); assert(); if (connection.userId !== this.userId) throw new Error('Propietario incorrecto.'); };
    return this.serialize(async () => {
      check(); const next = new Map(this.connections); next.set(connection.provider, connection);
      await this.credentials.save(connection.userId, [...next.values()], check); check(); this.connections = next;
    });
  }
  setConfig(config: CalendarConfig): void { this.config = config; }
  setUserId(userId: string | null): void {
    if (userId === this.userId) return;
    this.contextRevision++; this.stopPolling();
    const providers = [...this.connections.keys()]; this.connections.clear(); this.userId = userId;
    for (const provider of providers) this.emit('disconnected', { provider });
  }
  dispose(): void { this.unsubscribe?.(); this.unsubscribe = null; this.setUserId(null); this.stopPolling(); }
  connectGoogle(beforeSave?: () => void, userId?: string) { return connectGoogle(this, beforeSave, userId); }
  connectMicrosoft(beforeSave?: () => void, userId?: string) { return connectMicrosoft(this, beforeSave, userId); }
  async disconnect(provider: 'google' | 'microsoft'): Promise<void> {
    const assert = calendarSession(this); const owner = this.userId;
    await this.serialize(async () => {
      assert(); const next = new Map(this.connections); next.delete(provider);
      await this.credentials.save(owner!, [...next.values()], assert); assert(); this.connections = next;
      this.emit('disconnected', { provider });
    });
  }
  getConnections(): CalendarConnection[] { return [...this.connections.values()].filter(connection => connection.userId === this.userId); }
  getCurrentEvents(targetDate?: Date): Promise<CalendarEvent[]> { return getCurrentCalendarEvents(this, targetDate); }
  checkWorkHours(events: CalendarEvent[]) { return checkCalendarWorkHours(events); }
  startPolling(intervalMs = 60000): void { startCalendarPolling(this, intervalMs); }
  stopPolling(): void { stopCalendarPolling(this); }
  getPollingStatus() { return { isPolling: this.pollingInterval !== null, inWorkHours: this.isInWorkHoursState, currentEvent: this.currentWorkEvent }; }
  getGoogleAuth() { return getGoogleAuthForService(this); }
  createEvent(event: Parameters<typeof createGoogleEvent>[1], beforeExecute?: () => void) { return createGoogleEvent(this, event, this.mutationGuard(beforeExecute)); }
  updateEvent(eventId: string, updates: Parameters<typeof updateGoogleEvent>[2], beforeExecute?: () => void) { return updateGoogleEvent(this, eventId, updates, this.mutationGuard(beforeExecute)); }
  deleteEvent(eventId: string, calendarId?: string, beforeExecute?: () => void) { return deleteGoogleEvent(this, eventId, calendarId, this.mutationGuard(beforeExecute)); }
  private mutationGuard(beforeExecute?: () => void) {
    const assert = calendarSession(this, this.connections.get('google'));
    return () => { assert(); beforeExecute?.(); };
  }
}
