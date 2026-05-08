import type { ActivityLog } from '../../core/entities/ActivityLog';
import { monitoringRepository } from './repository';
import './window-api';

export async function generateSummaryForSession(
  userId: string,
  _sessionId: string,
  logs: ActivityLog[],
  sessionInfo: { startedAt: string; endedAt?: string; triggerType: string; calendarEventTitle?: string },
): Promise<any> {
  const result = await window.monitoring.generateSummary(logs.map(logToSummaryActivity), sessionInfo);
  if (!result.success) throw new Error(result.error || 'Failed to generate summary');

  await persistGeneratedSummary(userId, sessionInfo.startedAt, result.summary);
  return result.summary;
}

export async function sendSummaryViaWhatsApp(phoneNumber: string, summaryText: string): Promise<void> {
  const result = await window.monitoring.sendSummaryWhatsApp(phoneNumber, summaryText);
  if (!result.success) throw new Error(result.error || 'Failed to send via WhatsApp');
}

function logToSummaryActivity(log: ActivityLog) {
  return {
    timestamp: log.timestamp instanceof Date ? log.timestamp.toISOString() : String(log.timestamp),
    windowTitle: log.windowTitle,
    processName: log.processName,
    url: log.url,
    idle: log.idle,
    idleSeconds: log.idleSeconds || 0,
    ocrText: log.ocrText,
    durationSeconds: log.durationSeconds,
  };
}

async function persistGeneratedSummary(userId: string, startedAt: string, summary: any): Promise<void> {
  try {
    await monitoringRepository.saveDailySummary({
      userId,
      date: startedAt.split('T')[0],
      totalTimeSeconds: summary.totalTimeSeconds || 0,
      productiveTimeSeconds: summary.productiveTimeSeconds || 0,
      unproductiveTimeSeconds: 0,
      idleTimeSeconds: summary.idleTimeSeconds || 0,
      topApps: summary.topApps || [],
      aiSummary: summary.summaryText,
      projectsDetected: summary.projectsDetected?.map((project: string) => ({ projectId: '', projectName: project, timeSeconds: 0 })) || [],
    });
    console.log('[MonitoringService] Summary persisted to Supabase');
  } catch (err: any) {
    console.error('[MonitoringService] Failed to persist summary:', err.message);
  }
}
