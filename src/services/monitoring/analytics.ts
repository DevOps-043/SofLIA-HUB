import type { ActivityLog } from '../../core/entities/ActivityLog';

export interface AppUsageStat {
  name: string;
  durationSeconds: number;
  percentage: number;
}

export interface TimelineEntry {
  startTime: Date;
  endTime: Date;
  windowTitle: string;
  processName: string;
  idle: boolean;
  category: string;
}

export function calculateAppUsage(logs: ActivityLog[]): AppUsageStat[] {
  const appMap = new Map<string, number>();
  let totalSeconds = 0;

  for (const log of logs) {
    if (log.idle) continue;
    appMap.set(log.processName, (appMap.get(log.processName) || 0) + log.durationSeconds);
    totalSeconds += log.durationSeconds;
  }

  return Array.from(appMap.entries())
    .map(([name, durationSeconds]) => ({
      name,
      durationSeconds,
      percentage: totalSeconds > 0 ? (durationSeconds / totalSeconds) * 100 : 0,
    }))
    .sort((a, b) => b.durationSeconds - a.durationSeconds);
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
      current = createTimelineEntry(log);
    } else {
      current.endTime = new Date(log.timestamp.getTime() + log.durationSeconds * 1000);
      current.windowTitle = log.windowTitle;
    }
  }
  if (current) timeline.push(current);
  return timeline;
}

function createTimelineEntry(log: ActivityLog): TimelineEntry {
  return {
    startTime: log.timestamp,
    endTime: new Date(log.timestamp.getTime() + log.durationSeconds * 1000),
    windowTitle: log.windowTitle,
    processName: log.processName,
    idle: log.idle,
    category: log.category,
  };
}
