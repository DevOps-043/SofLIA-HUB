export function SidebarHeader({ isOpen, onToggle }: { isOpen: boolean; onToggle: () => void }) {
  return (
    <div className={`px-2.5 pt-2.5 pb-1.5 flex items-center ${isOpen ? 'justify-between' : 'justify-center'} min-h-[48px]`}>
      {isOpen && (
        <div className="flex min-w-0 items-center gap-2.5 overflow-hidden whitespace-nowrap">
          <img src="./assets/Icono.png" alt="Pulse" className="h-7 w-7 shrink-0 object-contain" />
          <div className="min-w-0 leading-none">
            <p className="truncate text-[13px] font-semibold tracking-wide text-[#0A2540] dark:text-white">Pulse</p>
            <p className="mt-1 text-[10px] font-medium text-secondary dark:text-white/40">Hub</p>
          </div>
        </div>
      )}
      <button
        onClick={onToggle}
        className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl text-secondary transition-all hover:bg-[#0A2540]/10 hover:text-[#0A2540] dark:text-white/50 dark:hover:bg-white/[0.06] dark:hover:text-white"
        title={isOpen ? 'Colapsar menu' : 'Expandir menu'}
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <rect x="3" y="4" width="18" height="16" rx="5" ry="5" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 3v18" />
        </svg>
      </button>
    </div>
  );
}
