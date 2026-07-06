interface CurrentVersionCardProps {
  state: string;
  checking: boolean;
  currentVersion: string;
}

export function CurrentVersionCard({ state, checking, currentVersion }: CurrentVersionCardProps) {
  return (
    <div className="flex items-center justify-between py-3 px-4 rounded-xl bg-surface-2/50 border border-border/50">
      <div className="flex items-center gap-3">
        <div className="flex flex-col">
          <span className="text-[10px] text-secondary font-medium uppercase tracking-wider">Versión instalada</span>
          <span className="text-lg font-semibold text-gray-900 dark:text-white tabular-nums">v{currentVersion}</span>
        </div>
      </div>
      <StatusPill state={state} checking={checking} />
    </div>
  );
}

function StatusPill({ state, checking }: { state: string; checking: boolean }) {
  const isChecking = checking || state === 'checking';

  const config = isChecking
    ? { label: 'Verificando', className: 'bg-accent/10 text-accent border-accent/20' }
    : state === 'available' || state === 'downloading' || state === 'downloaded'
      ? { label: 'Disponible', className: 'bg-accent/10 text-accent border-accent/20' }
      : state === 'error'
        ? { label: 'Error', className: 'bg-danger/10 text-danger border-danger/20' }
        : { label: 'Al día', className: 'bg-success/10 text-success border-success/20' };

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium border ${config.className}`}>
      {isChecking && (
        <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )}
      {config.label}
    </span>
  );
}
