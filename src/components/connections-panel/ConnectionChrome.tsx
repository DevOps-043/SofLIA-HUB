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
    <div className="rounded-2xl border border-border bg-surface overflow-hidden transition-colors">
      <button
        onClick={props.onToggle}
        className="w-full flex items-center gap-4 p-4 hover:bg-black/[0.02] dark:hover:bg-white/[0.03] transition-colors"
      >
        {props.icon}
        <div className="flex-1 text-left min-w-0">
          <p className="text-sm font-semibold text-gray-900 dark:text-white">{props.title}</p>
          <p className="text-xs text-secondary truncate">{props.subtitle}</p>
        </div>
        <StatusBadge connected={props.connected} />
        <ChevronIcon open={props.open} />
      </button>
      {props.open && <div className="px-4 pb-4 border-t border-border">{props.children}</div>}
    </div>
  );
}

export function StatusBadge({ connected }: { connected: boolean }) {
  return (
    <span className={`shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${connected ? 'bg-success/10 text-success border-success/20' : 'bg-surface-2 text-secondary border-border'}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-success' : 'bg-secondary/50'}`} />
      {connected ? 'Activo' : 'Inactivo'}
    </span>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg className={`w-4 h-4 text-secondary shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );
}
