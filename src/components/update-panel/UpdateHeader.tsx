export function UpdateHeader() {
  return (
    <div className="flex items-center gap-3">
      <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
        <svg className="w-4 h-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
      </div>
      <div>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Actualizaciones</h3>
        <p className="text-[11px] text-secondary">Mantén Pulse Hub al día</p>
      </div>
    </div>
  );
}
