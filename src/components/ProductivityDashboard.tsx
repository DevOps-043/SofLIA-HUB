import { useState, useEffect, useCallback, useRef } from 'react';
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
  startMonitoringSession,
  stopMonitoringSession,
  getMonitoringStatus,
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

  // ─── Calendar auto-monitoring ──────────────────────────────────────
  const [autoSessionInfo, setAutoSessionInfo] = useState<{ sessionId: string; eventTitle: string } | null>(null);
  const calendarAutoSessionIdRef = useRef<string | null>(null);
  const calendarAutoEventIdRef = useRef<string | null>(null);
  const manuallyStoppedEventIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (typeof (window as any).calendar === 'undefined') return;
    const cal = (window as any).calendar;

    // Check if already in work hours on mount
    cal.getStatus().then(async (s: any) => {
      if (s.inWorkHours && s.currentEvent && userId) {
        try {
          const status = await getMonitoringStatus();
          if (status.isRunning) return;
          const session = await startMonitoringSession(userId, 'calendar_auto', s.currentEvent.title);
          calendarAutoSessionIdRef.current = session.id;
          calendarAutoEventIdRef.current = s.currentEvent.id;
          setAutoSessionInfo({ sessionId: session.id, eventTitle: s.currentEvent.title });
        } catch (err: any) {
          console.error('[ProductivityDashboard] Calendar auto-start on mount failed:', err.message);
        }
      }
    }).catch(() => {});

    cal.onWorkStart(async (data: any) => {
      const event = data?.event;
      if (!event || !userId) return;
      if (manuallyStoppedEventIdRef.current === event.id) return;

      try {
        const status = await getMonitoringStatus();
        if (status.isRunning) return;
      } catch { /* proceed */ }

      try {
        console.log(`[ProductivityDashboard] Calendar auto-start: ${event.title}`);
        const session = await startMonitoringSession(userId, 'calendar_auto', event.title);
        calendarAutoSessionIdRef.current = session.id;
        calendarAutoEventIdRef.current = event.id;
        setAutoSessionInfo({ sessionId: session.id, eventTitle: event.title });
      } catch (err: any) {
        console.error('[ProductivityDashboard] Calendar auto-start failed:', err.message);
      }
    });

    cal.onWorkEnd(async () => {
      const sid = calendarAutoSessionIdRef.current;
      if (!sid || !userId) return;

      try {
        console.log('[ProductivityDashboard] Calendar auto-stop');
        await stopMonitoringSession(sid, userId);
      } catch (err: any) {
        console.error('[ProductivityDashboard] Calendar auto-stop failed:', err.message);
      } finally {
        calendarAutoSessionIdRef.current = null;
        calendarAutoEventIdRef.current = null;
        manuallyStoppedEventIdRef.current = null;
        setAutoSessionInfo(null);
      }
    });
  }, [userId]);

  const handleManualStop = useCallback(() => {
    manuallyStoppedEventIdRef.current = calendarAutoEventIdRef.current;
    calendarAutoSessionIdRef.current = null;
    calendarAutoEventIdRef.current = null;
    setAutoSessionInfo(null);
  }, []);

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
    // Refresh more frequently (15s) while monitoring is active, otherwise 60s
    const isToday = selectedDate === new Date().toISOString().split('T')[0];
    if (isToday) {
      const refreshMs = autoSessionInfo ? 15000 : 60000;
      const interval = setInterval(loadData, refreshMs);
      return () => clearInterval(interval);
    }
  }, [loadData, selectedDate, autoSessionInfo]);

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
    <div className="flex-1 h-full overflow-y-auto no-scrollbar bg-transparent">
      <div className="w-full px-6 py-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        
        {/* Date Selector & Stats Row */}
        <div className="flex flex-col gap-6 mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 bg-white/5 backdrop-blur-md border border-white/10 p-1.5 rounded-xl shadow-inner">
              <button
                onClick={() => {
                  const d = new Date(selectedDate + 'T12:00:00');
                  d.setDate(d.getDate() - 1);
                  setSelectedDate(d.toISOString().split('T')[0]);
                }}
                className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-all active:scale-95"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>

              <div className="relative group">
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  max={new Date().toISOString().split('T')[0]}
                  className="bg-transparent text-sm font-semibold text-white px-2 py-1 outline-none cursor-pointer"
                />
              </div>

              <button
                onClick={() => {
                  const d = new Date(selectedDate + 'T12:00:00');
                  d.setDate(d.getDate() + 1);
                  const today = new Date().toISOString().split('T')[0];
                  const next = d.toISOString().split('T')[0];
                  if (next <= today) setSelectedDate(next);
                }}
                disabled={isToday}
                className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-all disabled:opacity-20 active:scale-95"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>

            <div className="flex items-center gap-3">
              {!isToday && (
                <button
                  onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])}
                  className="text-xs font-semibold px-4 py-2 rounded-xl bg-accent text-white shadow-lg shadow-accent/20 hover:bg-accent/80 transition-all active:scale-95"
                >
                  Hoy
                </button>
              )}
              <button
                onClick={loadData}
                disabled={loadingData}
                className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:bg-white/10 transition-all active:rotate-180 duration-500"
                title="Actualizar datos"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className={`h-4.5 w-4.5 ${loadingData ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            </div>
          </div>

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard 
              label="Tiempo Total" 
              value={formatHM(totalActiveSeconds + totalIdleSeconds)} 
              icon="clock" 
              trend="neutral"
            />
            <MetricCard 
              label="Productivo" 
              value={formatHM(totalActiveSeconds)} 
              icon="check" 
              trend="up"
              color="emerald"
            />
            <MetricCard 
              label="Inactivo" 
              value={formatHM(totalIdleSeconds)} 
              icon="idle" 
              trend="down"
              color="rose"
            />
            <MetricCard 
              label="Capturas" 
              value={logs.length} 
              icon="camera" 
              trend="neutral"
              color="blue"
            />
          </div>
        </div>

        <div className="grid grid-cols-12 gap-8">
          {/* Main Content Column */}
          <div className="col-span-12 lg:col-span-8 space-y-8">
            <div className="bg-[#1a1c20]/50 backdrop-blur-sm border border-white/10 rounded-3xl overflow-hidden shadow-xl">
              <DailyTimeline timeline={timeline} />
            </div>
            
            <div className="bg-[#1a1c20]/50 backdrop-blur-sm border border-white/10 rounded-3xl overflow-hidden shadow-xl">
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

          {/* Sidebar Column */}
          <div className="col-span-12 lg:col-span-4 space-y-8">
            <div className="bg-[#1a1c20]/50 backdrop-blur-sm border border-white/10 rounded-3xl p-6 shadow-xl relative overflow-hidden group">
              <div className="absolute -top-10 -right-10 w-32 h-32 bg-accent/10 rounded-full blur-3xl group-hover:bg-accent/20 transition-all duration-700"></div>
              <MonitoringControls
                userId={userId}
                calendarAutoSessionId={autoSessionInfo?.sessionId}
                calendarEventTitle={autoSessionInfo?.eventTitle}
                onManualStop={handleManualStop}
                onDataFlushed={loadData}
              />
            </div>

            <div className="bg-[#1a1c20]/50 backdrop-blur-sm border border-white/10 rounded-3xl p-6 shadow-xl">
              <AppUsageChart stats={appStats} />
            </div>

            <div className="bg-[#1a1c20]/50 backdrop-blur-sm border border-white/10 rounded-3xl p-6 shadow-xl">
              <CalendarPanel />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value, icon, trend, color = 'blue' }: { 
  label: string, 
  value: string | number, 
  icon: string, 
  trend: 'up' | 'down' | 'neutral', 
  color?: 'emerald' | 'blue' | 'rose' | 'amber' 
}) {
  const colorMap = {
    emerald: 'border-emerald-500/10 hover:border-emerald-500/30 group/metric',
    blue: 'border-blue-500/10 hover:border-blue-500/30 group/metric',
    rose: 'border-rose-500/10 hover:border-rose-500/30 group/metric',
    amber: 'border-amber-500/10 hover:border-amber-500/30 group/metric',
  };

  const iconColors = {
    emerald: 'text-emerald-400 bg-emerald-500/10',
    blue: 'text-blue-400 bg-blue-500/10',
    rose: 'text-rose-400 bg-rose-500/10',
    amber: 'text-amber-400 bg-amber-500/10',
  };

  const icons = {
    clock: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    check: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    idle: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
    camera: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    )
  };

  return (
    <div className={`relative overflow-hidden bg-white/2 backdrop-blur-xl border rounded-4xl p-6 transition-all duration-500 hover:scale-[1.02] hover:bg-white/5 shadow-2xl ${colorMap[color]}`}>
      {/* Decorative Blur */}
      <div className={`absolute -right-8 -bottom-8 w-24 h-24 blur-3xl rounded-full opacity-20 transition-opacity group-hover/metric:opacity-40 ${iconColors[color].split(' ')[1]}`}></div>
      
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-4">
          <div className={`p-3 rounded-2xl transition-transform group-hover/metric:rotate-12 duration-300 ${iconColors[color]}`}>
            {icons[icon as keyof typeof icons]}
          </div>
          {trend !== 'neutral' && (
            <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter ${trend === 'up' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
              <svg className={`w-3 h-3 ${trend === 'down' ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 10l7-7m0 0l7 7m-7-7v18" />
              </svg>
              {trend === 'up' ? 'Óptimo' : 'Crítico'}
            </div>
          )}
        </div>
        
        <div className="space-y-1">
          <p className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">{label}</p>
          <p className="text-3xl font-black text-white tracking-tighter truncate">{value}</p>
        </div>
      </div>
    </div>
  );
}
