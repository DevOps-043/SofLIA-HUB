export function SettingsHeader({ onClose }: { onClose: () => void }) {
  return (
    <div className="relative z-10 flex items-center justify-between border-b border-border bg-surface px-7 py-5">
      <div className="flex items-center gap-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-[14px] border border-accent/20 bg-accent/[0.07]">
          <svg className="w-6 h-6 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        </div>
        <div>
          <h2 id="settings-modal-title" className="text-[1.55rem] font-normal leading-none tracking-[-0.025em] text-gray-900 dark:text-white" style={{ fontFamily: 'var(--font-system-display)' }}>Mi identidad</h2>
          <p className="mt-1.5 text-[11px] text-secondary">Personaliza cómo SofLIA colabora contigo.</p>
        </div>
      </div>
      <button
        onClick={onClose}
        aria-label="Cerrar ajustes"
        className="group flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-surface-2 text-secondary transition-colors hover:border-accent/30 hover:text-gray-900 dark:hover:text-white"
      >
        <svg className="w-5 h-5 transition-transform group-hover:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
