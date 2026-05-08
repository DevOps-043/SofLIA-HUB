export interface SmartFocusConfig {
  defaultMinutes?: number;
}

export interface SmartFocusStatus {
  active: boolean;
  endTime?: Date;
  eventId?: string;
  minutes?: number;
}
