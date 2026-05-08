interface DateSelectorProps {
  selectedDate: string;
  isToday: boolean;
  loadingData: boolean;
  onChange: (date: string) => void;
  onRefresh: () => void;
}

export function DateSelector({ selectedDate, isToday, loadingData, onChange, onRefresh }: DateSelectorProps) {
  const moveDate = (days: number) => {
    const date = new Date(selectedDate + 'T12:00:00');
    date.setDate(date.getDate() + days);
    const next = date.toISOString().split('T')[0];
    if (days < 0 || next <= new Date().toISOString().split('T')[0]) onChange(next);
  };

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-4 bg-gray-100 dark:bg-white/5 backdrop-blur-md border border-gray-200 dark:border-white/10 p-1.5 rounded-xl shadow-inner">
        <button onClick={() => moveDate(-1)} className="p-2 rounded-lg text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-white/10 transition-all active:scale-95">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <input
          type="date"
          value={selectedDate}
          onChange={(event) => onChange(event.target.value)}
          max={new Date().toISOString().split('T')[0]}
          className="bg-transparent text-sm font-semibold text-gray-900 dark:text-white px-2 py-1 outline-none cursor-pointer"
        />
        <button
          onClick={() => moveDate(1)}
          disabled={isToday}
          className="p-2 rounded-lg text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-white/10 transition-all disabled:opacity-20 active:scale-95"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      <div className="flex items-center gap-3">
        {!isToday && (
          <button onClick={() => onChange(new Date().toISOString().split('T')[0])} className="text-xs font-semibold px-4 py-2 rounded-xl bg-accent text-white shadow-lg shadow-accent/20 hover:bg-accent/80 transition-all active:scale-95">
            Hoy
          </button>
        )}
        <button onClick={onRefresh} disabled={loadingData} className="p-2.5 rounded-xl bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-white/10 transition-all active:rotate-180 duration-500" title="Actualizar datos">
          <svg xmlns="http://www.w3.org/2000/svg" className={`h-4.5 w-4.5 ${loadingData ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>
    </div>
  );
}
