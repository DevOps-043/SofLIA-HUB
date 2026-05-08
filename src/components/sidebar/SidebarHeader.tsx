export function SidebarHeader({ isOpen, onToggle }: { isOpen: boolean; onToggle: () => void }) {
  return (
    <div className={`px-4 pt-4 pb-2 flex items-center ${isOpen ? 'justify-between' : 'justify-center'} min-h-[50px]`}>
      {isOpen && (
        <div className="flex items-center gap-2 overflow-hidden whitespace-nowrap">
          <img src="./assets/Icono.png" alt="SofLIA" className="w-7 h-7 object-contain dark:filter-none filter-accent-themed" />
        </div>
      )}
      <button
        onClick={onToggle}
        className="text-gray-400 hover:text-gray-600 dark:hover:text-white transition-colors p-1"
        title={isOpen ? 'Colapsar menu' : 'Expandir menu'}
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 3v18" />
        </svg>
      </button>
    </div>
  );
}
