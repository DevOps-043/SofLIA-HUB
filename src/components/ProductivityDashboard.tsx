import { MonitoringControls } from './monitoring/MonitoringControls';
import { DailyTimeline } from './monitoring/DailyTimeline';
import { AppUsageChart } from './monitoring/AppUsageChart';
import { SummaryCard } from './monitoring/SummaryCard';
import { DateSelector } from './productivity-dashboard/DateSelector';
import { MetricCard } from './productivity-dashboard/MetricCard';
import { useCalendarAutoMonitoring } from './productivity-dashboard/useCalendarAutoMonitoring';
import { useProductivityData } from './productivity-dashboard/useProductivityData';

interface ProductivityDashboardProps {
  userId: string;
}

export function ProductivityDashboard({ userId }: ProductivityDashboardProps) {
  const { autoSessionInfo, handleManualStop } = useCalendarAutoMonitoring(userId);
  const {
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
  } = useProductivityData(userId, autoSessionInfo);

  return (
    <div className="flex-1 h-full overflow-y-auto no-scrollbar bg-transparent">
      <div className="w-full px-6 py-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex flex-col gap-6 mb-8">
          <DateSelector
            selectedDate={selectedDate}
            isToday={isToday}
            loadingData={loadingData}
            onChange={setSelectedDate}
            onRefresh={loadData}
          />

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard label="Tiempo Total" value={formatHM(totalActiveSeconds + totalIdleSeconds)} icon="clock" trend="neutral" />
            <MetricCard label="Productivo" value={formatHM(totalActiveSeconds)} icon="check" trend="up" color="emerald" />
            <MetricCard label="Inactivo" value={formatHM(totalIdleSeconds)} icon="idle" trend="down" color="rose" />
            <MetricCard label="Capturas" value={logs.length} icon="camera" trend="neutral" color="blue" />
          </div>
        </div>

        <div className="grid grid-cols-12 gap-8">
          <div className="col-span-12 lg:col-span-8 space-y-8">
            <div className="bg-white dark:bg-[#1a1c20]/50 backdrop-blur-sm border border-gray-200 dark:border-white/10 rounded-3xl overflow-hidden shadow-xl">
              <DailyTimeline timeline={timeline} />
            </div>
            <div className="bg-white dark:bg-[#1a1c20]/50 backdrop-blur-sm border border-gray-200 dark:border-white/10 rounded-3xl overflow-hidden shadow-xl">
              <SummaryCard summary={summary} userId={userId} logs={logs} selectedDate={selectedDate} onSummaryGenerated={setSummary} />
            </div>
          </div>

          <div className="col-span-12 lg:col-span-4 space-y-8">
            <div className="bg-white dark:bg-[#1a1c20]/50 backdrop-blur-sm border border-gray-200 dark:border-white/10 rounded-3xl p-6 shadow-xl relative overflow-hidden group">
              <div className="absolute -top-10 -right-10 w-32 h-32 bg-accent/10 rounded-full blur-3xl group-hover:bg-accent/20 transition-all duration-700" />
              <MonitoringControls
                userId={userId}
                calendarAutoSessionId={autoSessionInfo?.sessionId}
                calendarEventTitle={autoSessionInfo?.eventTitle}
                onManualStop={handleManualStop}
                onDataFlushed={loadData}
              />
            </div>

            <div className="bg-white dark:bg-[#1a1c20]/50 backdrop-blur-sm border border-gray-200 dark:border-white/10 rounded-3xl p-6 shadow-xl">
              <AppUsageChart stats={appStats} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
