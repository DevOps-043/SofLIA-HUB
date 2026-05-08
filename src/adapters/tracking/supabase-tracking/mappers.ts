import type { ActivityLog, DailySummary, MonitoringSession } from '../../../core/entities/ActivityLog';
import type { ActivityLogRow, SessionRow, SummaryRow } from './row-types';

export function rowToActivityLog(row: ActivityLogRow): ActivityLog {
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

export function activityLogToRow(log: ActivityLog): Partial<ActivityLogRow> {
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

export function rowToSession(row: SessionRow): MonitoringSession {
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

export function rowToSummary(row: SummaryRow): DailySummary {
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
