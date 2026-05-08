export interface ActivityLogEntry {
  timestamp: string;
  windowTitle: string;
  processName: string;
  url?: string;
  idle: boolean;
  idleSeconds: number;
  ocrText?: string;
  durationSeconds: number;
}

export interface SessionInfo {
  startedAt: string;
  endedAt?: string;
  triggerType: string;
  calendarEventTitle?: string;
}

export interface AppUsageStat {
  name: string;
  duration: number;
}

export interface SummaryStats {
  topApps: AppUsageStat[];
  totalIdle: number;
  totalActive: number;
  timelineText: string;
}

export interface GeneratedSummary {
  summaryText: string;
  topApps: AppUsageStat[];
  productiveTimeSeconds: number;
  idleTimeSeconds: number;
  totalTimeSeconds: number;
  projectsDetected: string[];
  difficulties: string[];
  highlights: string[];
}
