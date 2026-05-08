export function ProactiveHourGrid({ hours, onToggle }: { hours: number[]; onToggle: (hour: number) => void }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <label className="text-[8px] font-bold text-gray-500 uppercase tracking-widest px-1">Ventanas de Interaccion</label>
      </div>
      <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-12 gap-1.5">
        {Array.from({ length: 24 }, (_, hour) => (
          <button
            key={hour}
            onClick={() => onToggle(hour)}
            className={`flex flex-col items-center justify-center py-1.5 rounded-lg border transition-all ${hours.includes(hour) ? 'bg-purple-500/10 border-purple-500/20 text-purple-600 dark:text-purple-200' : 'bg-gray-50 dark:bg-black/20 border-gray-100 dark:border-white/[0.02] text-gray-400 dark:text-gray-800'}`}
          >
            <span className="text-[9px] font-mono font-bold leading-none">{String(hour).padStart(2, '0')}</span>
            <div className={`mt-1.5 w-1 h-1 rounded-full transition-all ${hours.includes(hour) ? 'bg-purple-400 scale-100 shadow-[0_0_8px_rgba(168,85,247,0.3)]' : 'bg-white/5 scale-50'}`} />
          </button>
        ))}
      </div>
    </div>
  );
}
