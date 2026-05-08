import type { ReactNode } from 'react';
import { STATUS_STYLES } from './styles';

export function ConfidenceBar({ value, size = 'sm' }: { value: number; size?: 'sm' | 'lg' }) {
  const pct = Math.round(value * 100);
  const color = pct >= 85 ? 'bg-emerald-500' : pct >= 60 ? 'bg-amber-500' : 'bg-red-500';
  const h = size === 'lg' ? 'h-1.5' : 'h-1';
  return (
    <div className="flex items-center gap-2">
      <div className={`flex-1 ${h} rounded-full bg-gray-200 dark:bg-white/[0.06] overflow-hidden`}>
        <div className={`${h} rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[11px] tabular-nums text-gray-500 min-w-[32px] text-right">{pct}%</span>
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] || 'bg-gray-500/15 text-gray-400 border-gray-500/20';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium tracking-wide uppercase border ${style}`}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}

export function SectionTitle({ children, count }: { children: ReactNode; count?: number }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <h5 className="text-[13px] font-semibold text-gray-700 dark:text-gray-200 tracking-tight">{children}</h5>
      {typeof count === 'number' && (
        <span className="text-[10px] tabular-nums bg-gray-100 dark:bg-white/[0.06] text-gray-500 px-1.5 py-0.5 rounded-md">{count}</span>
      )}
    </div>
  );
}

export function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-gray-200 dark:border-white/[0.06] py-6 flex items-center justify-center">
      <span className="text-[13px] text-gray-400 dark:text-gray-600">{text}</span>
    </div>
  );
}
