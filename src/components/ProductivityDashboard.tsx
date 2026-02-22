import { useState, useEffect, useCallback } from 'react';
import { MonitoringControls } from './monitoring/MonitoringControls';
import { CalendarPanel } from './monitoring/CalendarPanel';
import { DailyTimeline } from './monitoring/DailyTimeline';
import { AppUsageChart } from './monitoring/AppUsageChart';
import { SummaryCard } from './monitoring/SummaryCard';
import {
  getActivityLogsByDate,
  getSessionsByDate,
  getDailySummary,
  calculateAppUsage,
  buildTimeline,
  type AppUsageStat,
  type TimelineEntry,
} from '../services/monitoring-service';
import type { ActivityLog, DailySummary } from '../core/entities/ActivityLog';

interface ProductivityDashboardProps {
  userId: string;
}

export function ProductivityDashboard({ userId }: ProductivityDashboardProps) {
  const [selectedDate, setSelectedDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [appStats, setAppStats] = useState<AppUsageStat[]>([]);
  const [summary, setSummary] = useState<DailySummary | null>(null);
  const [sessionsCount, setSessionsCount] = useState(0);
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

      setLogs(activityLogs);
      setSessionsCount(sessions.length);
      setSummary(dailySummary);

      if (activityLogs.length > 0) {
        setTimeline(buildTimeline(activityLogs));
        setAppStats(calculateAppUsage(activityLogs));
      } else {
        setTimeline([]);
        setAppStats([]);
      }
    } catch (err) {
      console.error('[ProductivityDashboard] Error loading data:', err);
    } finally {
      setLoadingData(false);
    }
  }, [userId, selectedDate]);

  useEffect(() => {
    loadData();
    // Refresh every 60s if viewing today
    const isToday = selectedDate === new Date().toISOString().split('T')[0];
    if (isToday) {
      const interval = setInterval(loadData, 60000);
      return () => clearInterval(interval);
    }
  }, [loadData, selectedDate]);

  const isToday = selectedDate === new Date().toISOString().split('T')[0];

  const totalActiveSeconds = logs.filter(l => !l.idle).reduce((s, l) => s + l.durationSeconds, 0);
  const totalIdleSeconds = logs.filter(l => l.idle).reduce((s, l) => s + l.durationSeconds, 0);

  const formatHM = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };

  return (
    <div className="flex-1 h-full overflow-y-auto no-scrollbar bg-gray-50 dark:bg-[#0a0a0f]">
      <div className="max-w-6xl mx-auto px-6 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Productividad</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              {isToday ? 'Hoy' : new Date(selectedDate + 'T12:00:00').toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' })}
              {sessionsCount > 0 && ` — ${sessionsCount} sesion${sessionsCount > 1 ? 'es' : ''}`}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Date nav */}
            <button
              onClick={() => {
                const d = new Date(selectedDate + 'T12:00:00');
                d.setDate(d.getDate() - 1);
                setSelectedDate(d.toISOString().split('T')[0]);
              }}
              className="p-2 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              max={new Date().toISOString().split('T')[0]}
              className="text-sm bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg px-3 py-1.5 text-gray-700 dark:text-gray-300"
            />

            <button
              onClick={() => {
                const d = new Date(selectedDate + 'T12:00:00');
                d.setDate(d.getDate() + 1);
                const today = new Date().toISOString().split('T')[0];
                const next = d.toISOString().split('T')[0];
                if (next <= today) setSelectedDate(next);
              }}
              disabled={isToday}
              className="p-2 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors disabled:opacity-30"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>

            {!isToday && (
              <button
                onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])}
                className="text-xs px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors"
              >
                Hoy
              </button>
            )}

            <button
              onClick={loadData}
              disabled={loadingData}
              className="p-2 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
              title="Actualizar datos"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 ${loadingData ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
        </div>

        {/* Quick stats */}
        {logs.length > 0 && (
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="bg-white dark:bg-white/5 rounded-xl border border-gray-200 dark:border-white/10 p-4">
              <p className="text-[11px] uppercase tracking-wider text-gray-400 dark:text-gray-500 font-semibold">Tiempo total</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{formatHM(totalActiveSeconds + totalIdleSeconds)}</p>
            </div>
            <div className="bg-white dark:bg-white/5 rounded-xl border border-gray-200 dark:border-white/10 p-4">
              <p className="text-[11px] uppercase tracking-wider text-gray-400 dark:text-gray-500 font-semibold">Activo</p>
              <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">{formatHM(totalActiveSeconds)}</p>
            </div>
            <div className="bg-white dark:bg-white/5 rounded-xl border border-gray-200 dark:border-white/10 p-4">
              <p className="text-[11px] uppercase tracking-wider text-gray-400 dark:text-gray-500 font-semibold">Inactivo</p>
              <p className="text-2xl font-bold text-gray-400 dark:text-gray-500 mt-1">{formatHM(totalIdleSeconds)}</p>
            </div>
            <div className="bg-white dark:bg-white/5 rounded-xl border border-gray-200 dark:border-white/10 p-4">
              <p className="text-[11px] uppercase tracking-wider text-gray-400 dark:text-gray-500 font-semibold">Capturas</p>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">{logs.length}</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-3 gap-5">
          {/* Left column — Controls + Calendar + App Usage */}
          <div className="space-y-5">
            <MonitoringControls userId={userId} />
            <CalendarPanel />
            <AppUsageChart stats={appStats} />
          </div>

          {/* Center/Right — Timeline + Summary */}
          <div className="col-span-2 space-y-5">
            <DailyTimeline timeline={timeline} />
            <SummaryCard
              summary={summary}
              userId={userId}
              logs={logs}
              selectedDate={selectedDate}
              onSummaryGenerated={(newSummary) => {
                setSummary(newSummary);
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
