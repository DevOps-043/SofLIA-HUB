export function ProactiveHourGrid({ hours, onToggle }: { hours: number[]; onToggle: (hour: number) => void }) {
  return (
    <div className="space-y-3">
      <label className="block text-xs font-medium text-secondary">Ventanas de Interaccion</label>
      <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-12 gap-1.5">
        {Array.from({ length: 24 }, (_, hour) => (
          <button
            key={hour}
            onClick={() => onToggle(hour)}
            className={`flex flex-col items-center justify-center py-1.5 rounded-lg border transition-colors ${hours.includes(hour) ? 'bg-accent/10 border-accent/30 text-accent' : 'bg-surface-2 border-border text-secondary hover:border-accent/20'}`}
          >
            <span className="text-[11px] font-mono font-semibold leading-none">{String(hour).padStart(2, '0')}</span>
            <div className={`mt-1.5 w-1 h-1 rounded-full transition-all ${hours.includes(hour) ? 'bg-accent scale-100' : 'bg-secondary/30 scale-75'}`} />
          </button>
        ))}
      </div>
    </div>
  );
}
