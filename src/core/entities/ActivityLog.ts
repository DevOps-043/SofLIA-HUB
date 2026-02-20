export interface ActivityLog {
  id: string;
  userId: string;
  sessionId?: string;
  timestamp: Date;
  windowTitle: string;
  processName: string;
  url?: string;
  category: ActivityCategory;
  durationSeconds: number;
  idle: boolean;
  idleSeconds?: number;
  ocrText?: string;
  metadata?: Record<string, any>;
}

export type ActivityCategory = 'productive' | 'unproductive' | 'neutral' | 'uncategorized';

export interface MonitoringSession {
  id: string;
  userId: string;
  startedAt: Date;
  endedAt?: Date;
  triggerType: 'manual' | 'calendar_auto';
  calendarEventTitle?: string;
  totalActiveSeconds: number;
  totalIdleSeconds: number;
  summaryText?: string;
  status: 'active' | 'completed' | 'summarized';
  createdAt: Date;
}

export interface DailySummary {
  id?: string;
  userId?: string;
  date: string; // YYYY-MM-DD
  totalTimeSeconds: number;
  productiveTimeSeconds: number;
  unproductiveTimeSeconds: number;
  idleTimeSeconds: number;
  topApps: { name: string; duration: number }[];
  topWebsites?: { name: string; duration: number }[];
  aiSummary?: string;
  projectsDetected?: { projectId: string; projectName: string; timeSeconds: number }[];
}

export interface MonitoringConfig {
  intervalSeconds: number;       // 30-60, default 30
  idleThresholdSeconds: number;  // seconds before marking idle, default 120
  screenshotEnabled: boolean;
  ocrEnabled: boolean;
}

export interface ActivitySnapshot {
  windowTitle: string;
  processName: string;
  url?: string;
  idle: boolean;
  idleSeconds: number;
  screenshotPath?: string;
  ocrText?: string;
  timestamp: Date;
}

export interface MonitoringStatus {
  isRunning: boolean;
  sessionId: string | null;
  userId: string | null;
  snapshotCount: number;
  currentWindow?: string;
  config: MonitoringConfig;
}
