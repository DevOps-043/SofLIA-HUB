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

export interface CalendarServiceCore {
  connections: Map<string, CalendarConnection>;
  pollingInterval: NodeJS.Timeout | null;
  config: CalendarConfig;
  userId: string | null;
  isInWorkHoursState: boolean;
  currentWorkEvent: CalendarEvent | null;
  emit(eventName: string, ...args: any[]): boolean;
  saveConnections(): void;
  getGoogleAuth(): Promise<any | null>;
  getCurrentEvents(targetDate?: Date): Promise<CalendarEvent[]>;
  checkWorkHours(events: CalendarEvent[]): {
    inWorkHours: boolean;
    currentEvent: CalendarEvent | null;
    nextEvent: CalendarEvent | null;
  };
}
