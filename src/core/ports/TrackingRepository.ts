import { ActivityLog, MonitoringSession, DailySummary } from '../entities/ActivityLog';

export interface TrackingRepository {
  // Activity logs
  saveActivityLog(log: ActivityLog): Promise<void>;
  saveActivityLogBatch(logs: ActivityLog[]): Promise<void>;
  getLastActivityLog(userId: string): Promise<ActivityLog | null>;
  getActivityLogs(userId: string, sessionId: string): Promise<ActivityLog[]>;
  getActivityLogsByDate(userId: string, date: string): Promise<ActivityLog[]>;

  // Sessions
  createSession(session: Omit<MonitoringSession, 'id' | 'createdAt'>): Promise<MonitoringSession>;
  updateSession(id: string, updates: Partial<MonitoringSession>): Promise<void>;
  getActiveSession(userId: string): Promise<MonitoringSession | null>;
  getSessionsByDate(userId: string, date: string): Promise<MonitoringSession[]>;

  // Summaries
  saveDailySummary(summary: DailySummary): Promise<void>;
  getDailySummary(userId: string, date: string): Promise<DailySummary | null>;
  getWeeklySummaries(userId: string, startDate: string): Promise<DailySummary[]>;
}
