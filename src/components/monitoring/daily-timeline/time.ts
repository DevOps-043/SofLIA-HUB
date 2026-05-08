import type { TimelineEntry } from '../../../services/monitoring-service';

export function formatTimelineTime(date: Date | string) {
  return new Date(date).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
}

export function getEntryDurationMs(entry: TimelineEntry) {
  return new Date(entry.endTime).getTime() - new Date(entry.startTime).getTime();
}

export function getEntryCategory(entry: TimelineEntry) {
  return entry.idle ? 'idle' : (entry.category || 'uncategorized');
}
