import { Card } from '../ui/Card';
import { Toggle } from '../ui/Toggle';
import { ProactiveFeatureFilters } from './ProactiveFeatureFilters';
import { ProactiveHourGrid } from './ProactiveHourGrid';
import { ProactiveTestPanel } from './ProactiveTestPanel';
import type { ProactiveConfigState } from './types';

export function ProactiveBlock({ proactive }: { proactive: ProactiveConfigState }) {
  return (
    <Card>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center border transition-colors ${proactive.proactiveEnabled ? 'bg-accent/10 border-accent/20 text-accent' : 'bg-surface-2 border-border text-secondary'}`}>
            <BellIcon className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Pulse Proactiva</h3>
            <p className="text-xs text-secondary mt-0.5">WhatsApp Autonomo</p>
          </div>
        </div>
        <Toggle
          checked={proactive.proactiveEnabled}
          onChange={proactive.setProactiveEnabled}
          aria-label="Activar Pulse Proactiva"
        />
      </div>
      {proactive.proactiveEnabled && (
        <div className="space-y-6 mt-6 animate-in fade-in duration-300">
          <ProactiveFeatureFilters proactive={proactive} />
          <ProactiveHourGrid hours={proactive.notifHours} onToggle={proactive.toggleHour} />
          <ProactiveTestPanel proactive={proactive} />
        </div>
      )}
    </Card>
  );
}

export function BellIcon({ className }: { className: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
    </svg>
  );
}
