export interface AnomalyMonitorConfig {
  checkIntervalMs: number;
  alertThresholdMs: number;
  projectsDir: string;
}

export interface AnomalyMonitorStatus {
  running: boolean;
  lastCheck: Date | null;
  anomaliesDetected: number;
}

export interface UpcomingMeeting {
  id?: string;
  title: string;
  timeToStart: number;
  start: string | Date;
}
