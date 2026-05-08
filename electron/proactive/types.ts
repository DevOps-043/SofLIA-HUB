export interface ProactiveConfig {
  enabled: boolean;
  notificationHours: number[];
  checkIntervalMinutes: number;
  calendarReminders: boolean;
  taskReminders: boolean;
  systemAlerts: boolean;
  timezoneOffset: number;
}

export interface CalendarEventData {
  title: string;
  start: string;
  end: string;
  location?: string;
  description?: string;
}

export interface TaskData {
  title: string;
  status: string;
  priority?: string;
  dueDate?: string;
  projectName?: unknown;
  isOverdue: boolean;
  isDueToday: boolean;
}

export interface SystemAlert {
  type: 'high_cpu' | 'high_memory' | 'critical_process' | 'new_process';
  description: string;
  processName?: string;
  value?: number;
}

export interface ProactivePayload {
  calendarEvents: CalendarEventData[];
  urgentTasks: TaskData[];
  systemAlerts: SystemAlert[];
  timestamp: Date;
  userName: string;
}

export interface ProactiveRuntimeContext {
  config: ProactiveConfig;
  calendarService: any;
  waService: any;
  apiKey: string;
  lastNotifiedHours: Map<string, Set<number>>;
  getLastNotifiedDate: () => string;
  setLastNotifiedDate: (date: string) => void;
  emit: (event: string, payload: any) => boolean;
}
