type WorkflowHubHeaderProps = {
  loading: boolean;
  onRefresh: () => void;
};

export function WorkflowHubHeader({ loading, onRefresh }: WorkflowHubHeaderProps) {
  return (
    <div className="shrink-0 px-6 py-5 flex items-center justify-between">
      <div>
        <h3 className="text-lg font-bold text-gray-900 dark:text-white tracking-tight">Asistente Ejecutivo</h3>
        <p className="text-xs text-secondary mt-0.5">Workflows predeterminados, variantes y casos en una sola vista</p>
      </div>
      <button
        type="button"
        className="p-2.5 rounded-xl bg-surface-2 border border-border text-secondary hover:text-gray-900 dark:hover:text-white hover:border-accent/40 transition-colors"
        onClick={onRefresh}
        title="Recargar"
      >
        <svg className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      </button>
    </div>
  );
}
