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
  google?: { clientId: string; clientSecret: string };
  microsoft?: { clientId: string };
}

export interface CalendarConnectionResult {
  success: boolean;
  email?: string;
  error?: string;
  errorCode?: 'secure_storage_unavailable';
}

export interface CalendarServiceCore {
  connections: Map<string, CalendarConnection>;
  pollingInterval: NodeJS.Timeout | null;
  config: CalendarConfig;
  userId: string | null;
  contextRevision: number;
  isInWorkHoursState: boolean;
  currentWorkEvent: CalendarEvent | null;
  emit(eventName: string, ...args: unknown[]): boolean;
  saveConnections(assert?: () => void): Promise<void>;
  setConnection(connection: CalendarConnection, assert: () => void): Promise<void>;
  getGoogleAuth(): ReturnType<typeof import('./google-auth').getGoogleAuth>;
  getCurrentEvents(targetDate?: Date): Promise<CalendarEvent[]>;
  checkWorkHours(events: CalendarEvent[]): {
    inWorkHours: boolean;
    currentEvent: CalendarEvent | null;
    nextEvent: CalendarEvent | null;
  };
}
