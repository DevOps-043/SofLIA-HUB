/** Contrato público del calendario; no contiene credenciales OAuth. */
export type CalendarProvider = 'google' | 'microsoft';
export type CalendarResult = { success: boolean; error?: string; cancelled?: boolean; eventId?: string };
export type CalendarConnectionSnapshot = { provider: CalendarProvider; email?: string; isActive: boolean };
export type CalendarConnectionEvent = { provider: CalendarProvider; email?: string };
export interface CalendarEventDto {
  id: string; title: string; start: string; end: string; isAllDay: boolean;
  source: CalendarProvider; location?: string; description?: string;
}
export type CalendarCreateInput = {
  title: string; start: string; end: string; description?: string; location?: string; calendarId?: string;
};
export type CalendarUpdateInput = Partial<CalendarCreateInput>;
export type CalendarWorkEvent = { event: CalendarEventDto | null };
export type CalendarPollEvent = {
  events: CalendarEventDto[]; inWorkHours: boolean; currentEvent: CalendarEventDto | null; nextEvent: CalendarEventDto | null;
};
export type CalendarStatus = { isPolling: boolean; inWorkHours: boolean; currentEvent: CalendarEventDto | null };
export interface CalendarBridge {
  connectGoogle(): Promise<CalendarResult & { email?: string }>;
  connectMicrosoft(): Promise<CalendarResult & { email?: string }>;
  disconnect(provider: CalendarProvider): Promise<CalendarResult>;
  getConnections(): Promise<CalendarConnectionSnapshot[]>;
  getEvents(): Promise<CalendarResult & { events: CalendarEventDto[] }>;
  getStatus(): Promise<CalendarStatus>;
  startAuto(): Promise<CalendarResult>;
  stopAuto(): Promise<CalendarResult>;
  createEvent(input: CalendarCreateInput): Promise<CalendarResult>;
  updateEvent(eventId: string, input: CalendarUpdateInput): Promise<CalendarResult>;
  deleteEvent(eventId: string, calendarId?: string): Promise<CalendarResult>;
  onConnected(callback: (data: CalendarConnectionEvent) => void): () => void;
  onDisconnected(callback: (data: CalendarConnectionEvent) => void): () => void;
  onWorkStart(callback: (data: CalendarWorkEvent) => void): () => void;
  onWorkEnd(callback: (data: CalendarWorkEvent) => void): () => void;
  onPoll(callback: (data: CalendarPollEvent) => void): () => void;
  removeListeners(): void;
}
