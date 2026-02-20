/**
 * SupabaseTrackingRepository — Real implementation of TrackingRepository
 * using the LIA Supabase instance for persistence.
 */
import { supabase } from '../../lib/supabase';
import type { TrackingRepository } from '../../core/ports/TrackingRepository';
import type { ActivityLog, MonitoringSession, DailySummary } from '../../core/entities/ActivityLog';

// ─── DB row types (snake_case to match Supabase columns) ───────────

interface ActivityLogRow {
  id: string;
  session_id: string | null;
  user_id: string;
  timestamp: string;
  window_title: string;
  process_name: string;
  url: string | null;
  category: string;
  duration_seconds: number;
  idle: boolean;
  idle_seconds: number;
  ocr_text: string | null;
  metadata: Record<string, any>;
}

interface SessionRow {
  id: string;
  user_id: string;
  started_at: string;
  ended_at: string | null;
  trigger_type: string;
  calendar_event_title: string | null;
  total_active_seconds: number;
  total_idle_seconds: number;
  summary_text: string | null;
  status: string;
  created_at: string;
}

interface SummaryRow {
  id: string;
  user_id: string;
  date: string;
  total_time_seconds: number;
  productive_time_seconds: number;
  idle_time_seconds: number;
  top_apps: { name: string; duration: number }[];
  ai_summary: string | null;
  projects_detected: { projectId: string; projectName: string; timeSeconds: number }[];
  created_at: string;
}

// ─── Conversion helpers ─────────────────────────────────────────────

function rowToActivityLog(row: ActivityLogRow): ActivityLog {
  return {
    id: row.id,
    userId: row.user_id,
    sessionId: row.session_id || undefined,
    timestamp: new Date(row.timestamp),
    windowTitle: row.window_title,
    processName: row.process_name,
    url: row.url || undefined,
    category: row.category as any,
    durationSeconds: row.duration_seconds,
    idle: row.idle,
    idleSeconds: row.idle_seconds,
    ocrText: row.ocr_text || undefined,
    metadata: row.metadata,
  };
}

function activityLogToRow(log: ActivityLog): Partial<ActivityLogRow> {
  return {
    session_id: log.sessionId || null,
    user_id: log.userId,
    timestamp: log.timestamp.toISOString(),
    window_title: log.windowTitle,
    process_name: log.processName,
    url: log.url || null,
    category: log.category,
    duration_seconds: log.durationSeconds,
    idle: log.idle,
    idle_seconds: log.idleSeconds || 0,
    ocr_text: log.ocrText || null,
    metadata: log.metadata || {},
  };
}

function rowToSession(row: SessionRow): MonitoringSession {
  return {
    id: row.id,
    userId: row.user_id,
    startedAt: new Date(row.started_at),
    endedAt: row.ended_at ? new Date(row.ended_at) : undefined,
    triggerType: row.trigger_type as any,
    calendarEventTitle: row.calendar_event_title || undefined,
    totalActiveSeconds: row.total_active_seconds,
    totalIdleSeconds: row.total_idle_seconds,
    summaryText: row.summary_text || undefined,
    status: row.status as any,
    createdAt: new Date(row.created_at),
  };
}

function rowToSummary(row: SummaryRow): DailySummary {
  return {
    id: row.id,
    userId: row.user_id,
    date: row.date,
    totalTimeSeconds: row.total_time_seconds,
    productiveTimeSeconds: row.productive_time_seconds,
    unproductiveTimeSeconds: 0,
    idleTimeSeconds: row.idle_time_seconds,
    topApps: row.top_apps || [],
    aiSummary: row.ai_summary || undefined,
    projectsDetected: row.projects_detected || [],
  };
}

// ─── Repository implementation ──────────────────────────────────────

export class SupabaseTrackingRepository implements TrackingRepository {

  // ─── Activity Logs ────────────────────────────────────────────────

  async saveActivityLog(log: ActivityLog): Promise<void> {
    const { error } = await supabase
      .from('activity_logs')
      .insert(activityLogToRow(log));
    if (error) throw new Error(`Failed to save activity log: ${error.message}`);
  }

  async saveActivityLogBatch(logs: ActivityLog[]): Promise<void> {
    if (logs.length === 0) return;
    const rows = logs.map(activityLogToRow);
    const { error } = await supabase
      .from('activity_logs')
      .insert(rows);
    if (error) throw new Error(`Failed to save activity batch: ${error.message}`);
  }

  async getLastActivityLog(userId: string): Promise<ActivityLog | null> {
    const { data, error } = await supabase
      .from('activity_logs')
      .select('*')
      .eq('user_id', userId)
      .order('timestamp', { ascending: false })
      .limit(1)
      .single();
    if (error || !data) return null;
    return rowToActivityLog(data as ActivityLogRow);
  }

  async getActivityLogs(userId: string, sessionId: string): Promise<ActivityLog[]> {
    const { data, error } = await supabase
      .from('activity_logs')
      .select('*')
      .eq('user_id', userId)
      .eq('session_id', sessionId)
      .order('timestamp', { ascending: true });
    if (error || !data) return [];
    return (data as ActivityLogRow[]).map(rowToActivityLog);
  }

  async getActivityLogsByDate(userId: string, date: string): Promise<ActivityLog[]> {
    const startOfDay = `${date}T00:00:00.000Z`;
    const endOfDay = `${date}T23:59:59.999Z`;
    const { data, error } = await supabase
      .from('activity_logs')
      .select('*')
      .eq('user_id', userId)
      .gte('timestamp', startOfDay)
      .lte('timestamp', endOfDay)
      .order('timestamp', { ascending: true });
    if (error || !data) return [];
    return (data as ActivityLogRow[]).map(rowToActivityLog);
  }

  // ─── Sessions ─────────────────────────────────────────────────────

  async createSession(session: Omit<MonitoringSession, 'id' | 'createdAt'>): Promise<MonitoringSession> {
    const { data, error } = await supabase
      .from('monitoring_sessions')
      .insert({
        user_id: session.userId,
        started_at: session.startedAt.toISOString(),
        ended_at: session.endedAt?.toISOString() || null,
        trigger_type: session.triggerType,
        calendar_event_title: session.calendarEventTitle || null,
        total_active_seconds: session.totalActiveSeconds,
        total_idle_seconds: session.totalIdleSeconds,
        summary_text: session.summaryText || null,
        status: session.status,
      })
      .select()
      .single();
    if (error || !data) throw new Error(`Failed to create session: ${error?.message}`);
    return rowToSession(data as SessionRow);
  }

  async updateSession(id: string, updates: Partial<MonitoringSession>): Promise<void> {
    const row: Record<string, any> = {};
    if (updates.endedAt !== undefined) row.ended_at = updates.endedAt?.toISOString() || null;
    if (updates.totalActiveSeconds !== undefined) row.total_active_seconds = updates.totalActiveSeconds;
    if (updates.totalIdleSeconds !== undefined) row.total_idle_seconds = updates.totalIdleSeconds;
    if (updates.summaryText !== undefined) row.summary_text = updates.summaryText;
    if (updates.status !== undefined) row.status = updates.status;

    const { error } = await supabase
      .from('monitoring_sessions')
      .update(row)
      .eq('id', id);
    if (error) throw new Error(`Failed to update session: ${error.message}`);
  }

  async getActiveSession(userId: string): Promise<MonitoringSession | null> {
    const { data, error } = await supabase
      .from('monitoring_sessions')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('started_at', { ascending: false })
      .limit(1)
      .single();
    if (error || !data) return null;
    return rowToSession(data as SessionRow);
  }

  async getSessionsByDate(userId: string, date: string): Promise<MonitoringSession[]> {
    const startOfDay = `${date}T00:00:00.000Z`;
    const endOfDay = `${date}T23:59:59.999Z`;
    const { data, error } = await supabase
      .from('monitoring_sessions')
      .select('*')
      .eq('user_id', userId)
      .gte('started_at', startOfDay)
      .lte('started_at', endOfDay)
      .order('started_at', { ascending: true });
    if (error || !data) return [];
    return (data as SessionRow[]).map(rowToSession);
  }

  // ─── Summaries ────────────────────────────────────────────────────

  async saveDailySummary(summary: DailySummary): Promise<void> {
    const { error } = await supabase
      .from('daily_summaries')
      .upsert({
        user_id: summary.userId,
        date: summary.date,
        total_time_seconds: summary.totalTimeSeconds,
        productive_time_seconds: summary.productiveTimeSeconds,
        idle_time_seconds: summary.idleTimeSeconds,
        top_apps: summary.topApps,
        ai_summary: summary.aiSummary || null,
        projects_detected: summary.projectsDetected || [],
      }, { onConflict: 'user_id,date' });
    if (error) throw new Error(`Failed to save daily summary: ${error.message}`);
  }

  async getDailySummary(userId: string, date: string): Promise<DailySummary | null> {
    const { data, error } = await supabase
      .from('daily_summaries')
      .select('*')
      .eq('user_id', userId)
      .eq('date', date)
      .single();
    if (error || !data) return null;
    return rowToSummary(data as SummaryRow);
  }

  async getWeeklySummaries(userId: string, startDate: string): Promise<DailySummary[]> {
    const end = new Date(startDate);
    end.setDate(end.getDate() + 7);
    const endDate = end.toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('daily_summaries')
      .select('*')
      .eq('user_id', userId)
      .gte('date', startDate)
      .lt('date', endDate)
      .order('date', { ascending: true });
    if (error || !data) return [];
    return (data as SummaryRow[]).map(rowToSummary);
  }
}
