export function SidebarHeader({ isOpen, onToggle }: { isOpen: boolean; onToggle: () => void }) {
  return (
    <div
      className="px-2.5 pt-3 pb-1.5 flex items-center justify-center min-h-[48px]"
      style={{ fontFamily: 'var(--font-system-ui)' }}
    >
      {isOpen ? (
        <div className="flex w-full items-center justify-between min-w-0">
          <div className="flex min-w-0 items-center gap-2.5 overflow-hidden whitespace-nowrap">
            <img src="./assets/Icono.png" alt="Pulse Hub" className="h-6 w-6 shrink-0 object-contain" />
            <div className="min-w-0 leading-tight">
              <p className="truncate text-[13.5px] font-bold tracking-tight text-[#0A2540] dark:text-white">Pulse Hub</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onToggle}
            aria-label="Colapsar menú"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-gray-400 dark:text-white/45 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100/80 dark:hover:bg-white/[0.06] transition-all duration-150 focus:outline-none"
            title="Colapsar menú"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <rect x="3" y="4" width="18" height="16" rx="4" ry="4" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 4v16" />
            </svg>
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={onToggle}
          className="flex h-11 w-11 items-center justify-center rounded-xl hover:bg-gray-100/80 dark:hover:bg-white/[0.08] transition-all duration-150 focus:outline-none group"
          title="Expandir menú"
          aria-label="Expandir menú"
        >
          <img src="./assets/Icono.png" alt="Pulse Hub" className="h-7 w-7 object-contain transition-transform group-hover:scale-105" />
        </button>
      )}
    </div>
  );
}

