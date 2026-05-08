import type { ReactNode } from 'react';

interface ConnectionChromeProps {
  open: boolean;
  connected: boolean;
  icon: ReactNode;
  title: string;
  subtitle: string;
  onToggle: () => void;
  children: ReactNode;
}

export function ConnectionChrome(props: ConnectionChromeProps) {
  return (
    <div className="rounded-2xl border border-gray-200 dark:border-white/[0.06] bg-white dark:bg-white/[0.02] overflow-hidden transition-all">
      <button
        onClick={props.onToggle}
        className="w-full flex items-center gap-4 p-4 hover:bg-gray-50 dark:hover:bg-white/[0.03] transition-colors"
      >
        {props.icon}
        <div className="flex-1 text-left min-w-0">
          <p className="text-sm font-semibold text-gray-900 dark:text-white">{props.title}</p>
          <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">{props.subtitle}</p>
        </div>
        <StatusBadge connected={props.connected} />
        <ChevronIcon open={props.open} />
      </button>
      {props.open && <div className="px-4 pb-4 border-t border-gray-100 dark:border-white/[0.04]">{props.children}</div>}
    </div>
  );
}

export function StatusBadge({ connected }: { connected: boolean }) {
  return (
    <span className={`shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold ${connected ? 'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' : 'bg-gray-100 dark:bg-white/[0.04] text-gray-500 dark:text-gray-500'}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-emerald-500' : 'bg-gray-400 dark:bg-gray-600'}`} />
      {connected ? 'Activo' : 'Inactivo'}
    </span>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg className={`w-4 h-4 text-gray-400 shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );
}
