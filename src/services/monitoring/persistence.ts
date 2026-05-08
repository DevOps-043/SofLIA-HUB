import type { ActivityLog, ActivitySnapshot } from '../../core/entities/ActivityLog';
import { buildMeetingAutoLogMetadata } from '../meeting-auto-session-store';
import { monitoringRepository } from './repository';

export async function persistSnapshots(
  userId: string,
  sessionId: string,
  snapshots: ActivitySnapshot[],
): Promise<void> {
  const logs = snapshots.map((snapshot, index) => snapshotToActivityLog(userId, sessionId, snapshot, index));
  try {
    await monitoringRepository.saveActivityLogBatch(logs);
  } catch (err: any) {
    if (!isTransientNetworkError(err)) throw err;
    await new Promise((resolve) => setTimeout(resolve, 3000));
    await monitoringRepository.saveActivityLogBatch(logs);
  }
  console.log(`[MonitoringService] Persisted ${logs.length} activity logs`);
}

function snapshotToActivityLog(userId: string, sessionId: string, snap: ActivitySnapshot, index: number): ActivityLog {
  const timestamp = safeParseTimestamp(snap.timestamp);
  return {
    id: `${sessionId}-${timestamp.getTime()}-${index}`,
    userId,
    sessionId,
    timestamp,
    windowTitle: snap.windowTitle || 'Unknown',
    processName: snap.processName || 'Unknown',
    url: snap.url,
    category: 'uncategorized' as const,
    durationSeconds: 30,
    idle: snap.idle ?? false,
    idleSeconds: snap.idleSeconds ?? 0,
    ocrText: snap.ocrText,
    metadata: buildMeetingAutoLogMetadata(sessionId),
  };
}

function safeParseTimestamp(timestamp: any): Date {
  if (timestamp instanceof Date && !isNaN(timestamp.getTime())) return timestamp;
  if (typeof timestamp === 'string' || typeof timestamp === 'number') {
    const parsed = new Date(timestamp);
    if (!isNaN(parsed.getTime())) return parsed;
  }
  return new Date();
}

function isTransientNetworkError(err: any): boolean {
  return err.message?.includes('fetch') || err.message?.includes('network') || err.message?.includes('ECONNREFUSED');
}
