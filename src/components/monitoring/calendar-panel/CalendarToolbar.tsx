type Props = {
  connectionCount: number;
  isAutoMode: boolean;
  loading: string | null;
  onRefresh: () => void;
  onToggleAutoMode: () => void;
};

export function CalendarToolbar({ connectionCount, isAutoMode, loading, onRefresh, onToggleAutoMode }: Props) {
  return (
    <div className="flex items-center justify-between mb-8">
      <div>
        <h3 className="text-sm font-black text-white tracking-tight">Calendario</h3>
        <p className="text-[10px] text-gray-500 uppercase tracking-widest mt-0.5">Sincronizacion de eventos</p>
      </div>
      {connectionCount > 0 && (
        <div className="flex items-center gap-2">
          <button
            onClick={onRefresh}
            className={`p-2 rounded-xl bg-white/5 border border-white/10 text-gray-400 hover:text-white transition-all ${loading === 'refresh' ? 'animate-spin' : ''}`}
            title="Sincronizar ahora"
          >
            <RefreshIcon />
          </button>
          <button
            onClick={onToggleAutoMode}
            className={`group/auto relative flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all duration-300 ${isAutoMode ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-white/5 border-white/10 text-gray-500 hover:text-white hover:bg-white/10'}`}
          >
            <span className={`w-2 h-2 rounded-full ${isAutoMode ? 'bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.8)]' : 'bg-gray-600'}`} />
            <div className="absolute -top-10 left-1/2 -translate-x-1/2 px-2 py-1 bg-black/80 backdrop-blur-md rounded-lg text-[8px] font-black uppercase tracking-tighter opacity-0 group-hover/auto:opacity-100 transition-opacity whitespace-nowrap border border-white/5">
              Modo: {isAutoMode ? 'Automatico' : 'Manual'}
            </div>
          </button>
        </div>
      )}
    </div>
  );
}

function RefreshIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  );
}
