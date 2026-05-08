export type CalendarProvider = 'google' | 'microsoft';

export interface CalendarConnection {
  provider: CalendarProvider;
  email?: string;
  isActive: boolean;
}

export interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  isAllDay: boolean;
  source: CalendarProvider;
}
