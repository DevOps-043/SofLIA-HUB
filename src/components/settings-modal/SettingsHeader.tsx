export function SettingsHeader({ onClose }: { onClose: () => void }) {
  return (
    <div className="px-8 py-6 border-b border-border flex items-center justify-between relative z-10 bg-surface">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-accent/10 flex items-center justify-center border border-accent/20">
          <svg className="w-6 h-6 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        </div>
        <div>
          <h2 className="text-gray-900 dark:text-white text-lg font-semibold leading-none">Mi Identidad</h2>
          <p className="text-xs text-secondary mt-1.5">Configuracion del motor de personalizacion</p>
        </div>
      </div>
      <button
        onClick={onClose}
        className="w-10 h-10 rounded-xl bg-surface-2 border border-border flex items-center justify-center text-secondary hover:text-gray-900 dark:hover:text-white hover:border-accent/40 transition-colors group"
      >
        <svg className="w-5 h-5 transition-transform group-hover:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
