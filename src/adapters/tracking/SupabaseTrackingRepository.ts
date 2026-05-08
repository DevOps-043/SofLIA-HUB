import type { ActivityLog, DailySummary, MonitoringSession } from '../../core/entities/ActivityLog';
import type { TrackingRepository } from '../../core/ports/TrackingRepository';
import { createSession, getActiveSession, getSessionsByDate, updateSession } from './supabase-tracking/sessions';
import { getDailySummary, getWeeklySummaries, saveDailySummary } from './supabase-tracking/summaries';
import {
  getActivityLogs,
  getActivityLogsByDate,
  getLastActivityLog,
  saveActivityLog,
  saveActivityLogBatch,
} from './supabase-tracking/activity-logs';

export class SupabaseTrackingRepository implements TrackingRepository {
  saveActivityLog(log: ActivityLog): Promise<void> {
    return saveActivityLog(log);
  }

  saveActivityLogBatch(logs: ActivityLog[]): Promise<void> {
    return saveActivityLogBatch(logs);
  }

  getLastActivityLog(userId: string): Promise<ActivityLog | null> {
    return getLastActivityLog(userId);
  }

  getActivityLogs(userId: string, sessionId: string): Promise<ActivityLog[]> {
    return getActivityLogs(userId, sessionId);
  }

  getActivityLogsByDate(userId: string, date: string): Promise<ActivityLog[]> {
    return getActivityLogsByDate(userId, date);
  }

  createSession(session: Omit<MonitoringSession, 'id' | 'createdAt'>): Promise<MonitoringSession> {
    return createSession(session);
  }

  updateSession(id: string, updates: Partial<MonitoringSession>): Promise<void> {
    return updateSession(id, updates);
  }

  getActiveSession(userId: string): Promise<MonitoringSession | null> {
    return getActiveSession(userId);
  }

  getSessionsByDate(userId: string, date: string): Promise<MonitoringSession[]> {
    return getSessionsByDate(userId, date);
  }

  saveDailySummary(summary: DailySummary): Promise<void> {
    return saveDailySummary(summary);
  }

  getDailySummary(userId: string, date: string): Promise<DailySummary | null> {
    return getDailySummary(userId, date);
  }

  getWeeklySummaries(userId: string, startDate: string): Promise<DailySummary[]> {
    return getWeeklySummaries(userId, startDate);
  }
}
