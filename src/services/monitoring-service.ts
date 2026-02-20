/**
 * Monitoring Service (Renderer-side)
 * Wraps IPC calls to the main process MonitoringService and manages
 * session lifecycle with Supabase persistence.
 */
import { SupabaseTrackingRepository } from '../adapters/tracking/SupabaseTrackingRepository';
import type { ActivityLog, MonitoringSession, MonitoringConfig, ActivitySnapshot, MonitoringStatus } from '../core/entities/ActivityLog';

// ─── Window type augmentation ───────────────────────────────────────

declare global {
  interface Window {
    monitoring: {
      start: (userId: string, sessionId: string) => Promise<{ success: boolean; error?: string }>;
      stop: () => Promise<{ success: boolean; snapshotCount?: number; error?: string }>;
      getStatus: () => Promise<MonitoringStatus>;
      setConfig: (config: Partial<MonitoringConfig>) => Promise<{ success: boolean; config?: MonitoringConfig }>;
      cleanupScreenshots: () => Promise<{ success: boolean; deleted?: number }>;
      generateSummary: (activities: any[], sessionInfo: any) => Promise<{ success: boolean; summary?: any; error?: string }>;
      sendSummaryWhatsApp: (phoneNumber: string, summaryText: string) => Promise<{ success: boolean; error?: string }>;
      onSnapshot: (cb: (snapshot: ActivitySnapshot) => void) => void;
      onSessionStarted: (cb: (data: { userId: string; sessionId: string }) => void) => void;
      onSessionEnded: (cb: (data: { userId: string; sessionId: string; snapshotCount: number; pendingSnapshots: ActivitySnapshot[] }) => void) => void;
      onFlush: (cb: (data: { userId: string; sessionId: string; snapshots: ActivitySnapshot[] }) => void) => void;
      onError: (cb: (err: { message: string }) => void) => void;
      onSummaryGenerated: (cb: (data: { userId: string; sessionId: string; summary: any }) => void) => void;
      removeListeners: () => void;
    };
  }
}

// ─── Repository singleton ───────────────────────────────────────────

const repo = new SupabaseTrackingRepository();

// ─── Session management ─────────────────────────────────────────────

/**
 * Start a new monitoring session.
 * Creates session in Supabase, then starts the main-process capture loop.
 */
export async function startMonitoringSession(
  userId: string,
  triggerType: 'manual' | 'calendar_auto' = 'manual',
  calendarEventTitle?: string
): Promise<MonitoringSession> {
  // Create session in Supabase
  const session = await repo.createSession({
    userId,
    startedAt: new Date(),
    triggerType,
    calendarEventTitle,
    totalActiveSeconds: 0,
    totalIdleSeconds: 0,
    status: 'active',
  });

  // Start main-process capture loop
  const result = await window.monitoring.start(userId, session.id);
  if (!result.success) {
    throw new Error(result.error || 'Failed to start monitoring');
  }

  return session;
}

/**
 * Stop the current monitoring session.
 * Stops capture loop, flushes remaining snapshots, updates session in Supabase.
 */
export async function stopMonitoringSession(sessionId: string, _userId: string): Promise<void> {
  await window.monitoring.stop();

  // Update session in Supabase
  await repo.updateSession(sessionId, {
    endedAt: new Date(),
    status: 'completed',
  });
}

/**
 * Get monitoring status from main process.
 */
export async function getMonitoringStatus(): Promise<MonitoringStatus> {
  return window.monitoring.getStatus();
}

/**
 * Update monitoring config.
 */
export async function updateMonitoringConfig(config: Partial<MonitoringConfig>): Promise<void> {
  await window.monitoring.setConfig(config);
}

// ─── Data persistence from flush events ─────────────────────────────

/**
 * Save a batch of snapshots to Supabase as activity logs.
 * Called when the main process emits a 'flush' event.
 */
export async function persistSnapshots(
  userId: string,
  sessionId: string,
  snapshots: ActivitySnapshot[]
): Promise<void> {
  const logs: ActivityLog[] = snapshots.map((snap, i) => ({
    id: `${sessionId}-${snap.timestamp.getTime ? snap.timestamp.getTime() : new Date(snap.timestamp as any).getTime()}-${i}`,
    userId,
    sessionId,
    timestamp: snap.timestamp instanceof Date ? snap.timestamp : new Date(snap.timestamp as any),
    windowTitle: snap.windowTitle,
    processName: snap.processName,
    url: snap.url,
    category: 'uncategorized' as const,
    durationSeconds: 30,
    idle: snap.idle,
    idleSeconds: snap.idleSeconds,
    ocrText: snap.ocrText,
  }));

  try {
    await repo.saveActivityLogBatch(logs);
    console.log(`[MonitoringService] Persisted ${logs.length} activity logs`);
  } catch (err: any) {
    console.error('[MonitoringService] Failed to persist snapshots:', err.message);
  }
}

// ─── Data retrieval ─────────────────────────────────────────────────

export async function getActivityLogsByDate(userId: string, date: string) {
  return repo.getActivityLogsByDate(userId, date);
}

export async function getSessionsByDate(userId: string, date: string) {
  return repo.getSessionsByDate(userId, date);
}

export async function getDailySummary(userId: string, date: string) {
  return repo.getDailySummary(userId, date);
}

export async function getActiveSession(userId: string) {
  return repo.getActiveSession(userId);
}

// ─── Analytics helpers ──────────────────────────────────────────────

export interface AppUsageStat {
  name: string;
  durationSeconds: number;
  percentage: number;
}

export function calculateAppUsage(logs: ActivityLog[]): AppUsageStat[] {
  const appMap = new Map<string, number>();
  let totalSeconds = 0;

  for (const log of logs) {
    if (!log.idle) {
      const current = appMap.get(log.processName) || 0;
      appMap.set(log.processName, current + log.durationSeconds);
      totalSeconds += log.durationSeconds;
    }
  }

  const stats: AppUsageStat[] = [];
  for (const [name, duration] of appMap.entries()) {
    stats.push({
      name,
      durationSeconds: duration,
      percentage: totalSeconds > 0 ? (duration / totalSeconds) * 100 : 0,
    });
  }

  return stats.sort((a, b) => b.durationSeconds - a.durationSeconds);
}

export interface TimelineEntry {
  startTime: Date;
  endTime: Date;
  windowTitle: string;
  processName: string;
  idle: boolean;
  category: string;
}

export function buildTimeline(logs: ActivityLog[]): TimelineEntry[] {
  if (logs.length === 0) return [];

  const timeline: TimelineEntry[] = [];
  let current: TimelineEntry | null = null;

  for (const log of logs) {
    if (!current || current.processName !== log.processName || current.idle !== log.idle) {
      if (current) {
        current.endTime = log.timestamp;
        timeline.push(current);
      }
      current = {
        startTime: log.timestamp,
        endTime: new Date(log.timestamp.getTime() + log.durationSeconds * 1000),
        windowTitle: log.windowTitle,
        processName: log.processName,
        idle: log.idle,
        category: log.category,
      };
    } else {
      current.endTime = new Date(log.timestamp.getTime() + log.durationSeconds * 1000);
      current.windowTitle = log.windowTitle; // Update to latest title
    }
  }

  if (current) {
    timeline.push(current);
  }

  return timeline;
}

// ─── Summary generation ──────────────────────────────────────────────

/**
 * Trigger summary generation for a given set of activity logs.
 */
export async function generateSummaryForSession(
  userId: string,
  _sessionId: string,
  logs: ActivityLog[],
  sessionInfo: { startedAt: string; endedAt?: string; triggerType: string; calendarEventTitle?: string }
): Promise<any> {
  const activities = logs.map(log => ({
    timestamp: log.timestamp instanceof Date ? log.timestamp.toISOString() : String(log.timestamp),
    windowTitle: log.windowTitle,
    processName: log.processName,
    url: log.url,
    idle: log.idle,
    idleSeconds: log.idleSeconds || 0,
    ocrText: log.ocrText,
    durationSeconds: log.durationSeconds,
  }));

  const result = await window.monitoring.generateSummary(activities, sessionInfo);
  if (!result.success) throw new Error(result.error || 'Failed to generate summary');

  const summary = result.summary;

  // Persist to Supabase
  try {
    await repo.saveDailySummary({
      userId,
      date: sessionInfo.startedAt.split('T')[0],
      totalTimeSeconds: summary.totalTimeSeconds || 0,
      productiveTimeSeconds: summary.productiveTimeSeconds || 0,
      unproductiveTimeSeconds: 0,
      idleTimeSeconds: summary.idleTimeSeconds || 0,
      topApps: summary.topApps || [],
      aiSummary: summary.summaryText,
      projectsDetected: summary.projectsDetected?.map((p: string) => ({ projectId: '', projectName: p, timeSeconds: 0 })) || [],
    });
    console.log('[MonitoringService] Summary persisted to Supabase');
  } catch (err: any) {
    console.error('[MonitoringService] Failed to persist summary:', err.message);
  }

  return summary;
}

/**
 * Send a summary via WhatsApp.
 */
export async function sendSummaryViaWhatsApp(phoneNumber: string, summaryText: string): Promise<void> {
  const result = await window.monitoring.sendSummaryWhatsApp(phoneNumber, summaryText);
  if (!result.success) throw new Error(result.error || 'Failed to send via WhatsApp');
}
