import type { Dispatch, SetStateAction } from 'react';
import type { ProactiveConfigState } from './types';

interface FeatureFilter {
  id: string;
  active: boolean;
  set: Dispatch<SetStateAction<boolean>>;
  icon: JSX.Element;
  label: string;
}

export function ProactiveFeatureFilters({ proactive }: { proactive: ProactiveConfigState }) {
  const filters: FeatureFilter[] = [
    { id: 'cal', active: proactive.calendarReminders, set: proactive.setCalendarReminders, icon: <CalendarIcon />, label: 'Eventos' },
    { id: 'prj', active: proactive.taskReminders, set: proactive.setTaskReminders, icon: <TasksIcon />, label: 'Tareas' },
    { id: 'sys', active: proactive.systemAlerts, set: proactive.setSystemAlerts, icon: <StatusIcon />, label: 'Status' },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
      {filters.map((filter) => (
        <button
          key={filter.id}
          onClick={() => filter.set(!filter.active)}
          className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-[9px] font-bold uppercase tracking-wider transition-all ${filter.active ? 'bg-purple-500/5 border-purple-500/20 text-purple-600 dark:text-purple-400' : 'bg-gray-50 dark:bg-black/20 border-gray-100 dark:border-white/[0.03] text-gray-400 dark:text-gray-700'}`}
        >
          {filter.icon}
          <span className="flex-1 text-left">{filter.label}</span>
        </button>
      ))}
    </div>
  );
}

function CalendarIcon() {
  return <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>;
}

function TasksIcon() {
  return <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>;
}

function StatusIcon() {
  return <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>;
}
