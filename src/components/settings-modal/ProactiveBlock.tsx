import { ProactiveFeatureFilters } from './ProactiveFeatureFilters';
import { ProactiveHourGrid } from './ProactiveHourGrid';
import { ProactiveTestPanel } from './ProactiveTestPanel';
import type { ProactiveConfigState } from './types';

export function ProactiveBlock({ proactive }: { proactive: ProactiveConfigState }) {
  return (
    <div className="bg-gray-50/50 dark:bg-white/[0.03] backdrop-blur-md border border-gray-100 dark:border-white/[0.05] rounded-[2rem] p-6 relative overflow-hidden group">
      <div className="absolute top-0 right-0 p-6 opacity-[0.03] group-hover:opacity-[0.06] transition-opacity duration-700">
        <BellIcon className="w-32 h-32 text-purple-500" />
      </div>
      <div className="flex items-center justify-between mb-6 relative z-10">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center border transition-all duration-500 ${proactive.proactiveEnabled ? 'bg-purple-500/10 border-purple-500/20 shadow-lg shadow-purple-500/5 scale-105' : 'bg-white/5 border-white/5 grayscale'}`}>
            <BellIcon className={`w-5 h-5 transition-colors duration-500 ${proactive.proactiveEnabled ? 'text-purple-400' : 'text-gray-600'}`} />
          </div>
          <div>
            <h4 className="text-[10px] font-bold text-gray-900 dark:text-white/90 uppercase tracking-[0.2em]">SofLIA Proactiva</h4>
            <p className="text-[8px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-widest mt-0.5">WhatsApp Autonomo</p>
          </div>
        </div>
        <button
          onClick={() => proactive.setProactiveEnabled(!proactive.proactiveEnabled)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-all duration-500 ${proactive.proactiveEnabled ? 'bg-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.3)]' : 'bg-white/10'}`}
        >
          <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-300 ${proactive.proactiveEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
        </button>
      </div>
      {proactive.proactiveEnabled && (
        <div className="space-y-6 animate-in fade-in duration-500 relative z-10">
          <ProactiveFeatureFilters proactive={proactive} />
          <ProactiveHourGrid hours={proactive.notifHours} onToggle={proactive.toggleHour} />
          <ProactiveTestPanel proactive={proactive} />
        </div>
      )}
    </div>
  );
}

export function BellIcon({ className }: { className: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
    </svg>
  );
}
