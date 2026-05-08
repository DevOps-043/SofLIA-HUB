type PanelHeaderProps = {
  error: string | null;
  loading: boolean;
  notice: string | null;
  onReload: () => void;
  setError: (value: string | null) => void;
  setNotice: (value: string | null) => void;
};

export function PanelHeader({
  error,
  loading,
  notice,
  onReload,
  setError,
  setNotice,
}: PanelHeaderProps) {
  return (
    <>
      <div className="shrink-0 px-6 py-5 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white tracking-tight">Meeting Ops</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Importar, analizar y sincronizar reuniones</p>
        </div>
        <button type="button" className="p-2.5 rounded-xl bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-white/10 transition-all" onClick={onReload} title="Recargar">
          <svg className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>

      {(error || notice) && (
        <div className="shrink-0 px-6 pb-2 space-y-2">
          {error && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-2.5 text-xs text-red-600 dark:text-red-300 flex items-center justify-between">
              {error}
              <button type="button" className="text-red-500/60 hover:text-red-400 ml-2" onClick={() => setError(null)}>x</button>
            </div>
          )}
          {notice && (
            <div className="rounded-xl border border-accent/20 bg-accent/10 px-4 py-2.5 text-xs text-accent flex items-center justify-between">
              {notice}
              <button type="button" className="text-accent/60 hover:text-accent ml-2" onClick={() => setNotice(null)}>x</button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
