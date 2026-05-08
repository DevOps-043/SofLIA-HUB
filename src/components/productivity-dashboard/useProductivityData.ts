import { useCallback, useEffect, useState } from 'react';
import {
  buildTimeline,
  calculateAppUsage,
  getActivityLogsByDate,
  getDailySummary,
  getSessionsByDate,
  type AppUsageStat,
  type TimelineEntry,
} from '../../services/monitoring-service';
import type { ActivityLog, DailySummary } from '../../core/entities/ActivityLog';

type AutoSessionInfo = { sessionId: string; eventTitle: string } | null;

export function useProductivityData(userId: string, autoSessionInfo: AutoSessionInfo) {
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [appStats, setAppStats] = useState<AppUsageStat[]>([]);
  const [summary, setSummary] = useState<DailySummary | null>(null);
  const [loadingData, setLoadingData] = useState(false);

  const loadData = useCallback(async () => {
    if (!userId) return;
    setLoadingData(true);
    try {
      const [activityLogs, sessions, dailySummary] = await Promise.all([
        getActivityLogsByDate(userId, selectedDate).catch(() => []),
        getSessionsByDate(userId, selectedDate).catch(() => []),
        getDailySummary(userId, selectedDate).catch(() => null),
      ]);

      void sessions;
      setLogs(activityLogs);
      setSummary(dailySummary);
      setTimeline(activityLogs.length > 0 ? buildTimeline(activityLogs) : []);
      setAppStats(activityLogs.length > 0 ? calculateAppUsage(activityLogs) : []);
    } catch (err) {
      console.error('[ProductivityDashboard] Error loading data:', err);
    } finally {
      setLoadingData(false);
    }
  }, [userId, selectedDate]);

  useEffect(() => {
    loadData();
    const isToday = selectedDate === new Date().toISOString().split('T')[0];
    if (!isToday) return;
    const interval = setInterval(loadData, autoSessionInfo ? 15000 : 60000);
    return () => clearInterval(interval);
  }, [loadData, selectedDate, autoSessionInfo]);

  const totalActiveSeconds = logs.filter(log => !log.idle).reduce((total, log) => total + log.durationSeconds, 0);
  const totalIdleSeconds = logs.filter(log => log.idle).reduce((total, log) => total + log.durationSeconds, 0);
  const isToday = selectedDate === new Date().toISOString().split('T')[0];

  return {
    selectedDate,
    setSelectedDate,
    logs,
    timeline,
    appStats,
    summary,
    setSummary,
    loadingData,
    loadData,
    totalActiveSeconds,
    totalIdleSeconds,
    isToday,
    formatHM,
  };
}

function formatHM(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}
