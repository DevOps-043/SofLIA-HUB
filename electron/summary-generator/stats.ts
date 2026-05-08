import type { ActivityLogEntry, SummaryStats } from './types';

export function buildSummaryStats(activities: ActivityLogEntry[]): SummaryStats {
  const appUsage = new Map<string, number>();
  let totalIdle = 0;
  let totalActive = 0;

  for (const activity of activities) {
    if (activity.idle) {
      totalIdle += activity.durationSeconds;
    } else {
      totalActive += activity.durationSeconds;
      appUsage.set(activity.processName, (appUsage.get(activity.processName) || 0) + activity.durationSeconds);
    }
  }

  const topApps = Array.from(appUsage.entries())
    .map(([name, duration]) => ({ name, duration }))
    .sort((a, b) => b.duration - a.duration)
    .slice(0, 10);

  return {
    topApps,
    totalIdle,
    totalActive,
    timelineText: buildTimelineText(activities),
  };
}

function buildTimelineText(activities: ActivityLogEntry[]): string {
  return activities
    .filter((activity) => !activity.idle)
    .map((activity) => {
      const time = new Date(activity.timestamp).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
      const ocrSnippet = activity.ocrText ? ` | Texto visible: "${activity.ocrText.slice(0, 200)}"` : '';
      const url = activity.url ? ` (${activity.url})` : '';
      return `${time} - ${activity.processName}: ${activity.windowTitle.slice(0, 100)}${url}${ocrSnippet}`;
    })
    .join('\n');
}
