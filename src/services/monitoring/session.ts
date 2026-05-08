import type { MonitoringConfig, MonitoringSession, MonitoringStatus } from '../../core/entities/ActivityLog';
import { monitoringRepository } from './repository';
import './window-api';

export async function startMonitoringSession(
  userId: string,
  triggerType: 'manual' | 'calendar_auto' | 'meeting_auto' = 'manual',
  calendarEventTitle?: string,
): Promise<MonitoringSession> {
  const session = await monitoringRepository.createSession({
    userId,
    startedAt: new Date(),
    triggerType,
    calendarEventTitle,
    totalActiveSeconds: 0,
    totalIdleSeconds: 0,
    status: 'active',
  });

  const result = await window.monitoring.start(userId, session.id);
  if (!result.success) throw new Error(result.error || 'Failed to start monitoring');
  return session;
}

export async function stopMonitoringSession(sessionId: string, _userId: string): Promise<void> {
  await window.monitoring.stop();
  await monitoringRepository.updateSession(sessionId, { endedAt: new Date(), status: 'completed' });
}

export async function getMonitoringStatus(): Promise<MonitoringStatus> {
  return window.monitoring.getStatus();
}

export async function updateMonitoringConfig(config: Partial<MonitoringConfig>): Promise<void> {
  await window.monitoring.setConfig(config);
}
