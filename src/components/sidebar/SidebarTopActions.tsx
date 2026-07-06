export function SidebarTopActions({
  isOpen,
  onNewChat,
  onCreateFolderClick,
  onOpenSearch,
}: {
  isOpen: boolean;
  onNewChat: () => void;
  onCreateFolderClick: () => void;
  onOpenSearch: () => void;
}) {
  return (
    <div className={`pb-3 pt-2 flex flex-col gap-2 ${isOpen ? 'px-3' : 'px-1 items-center'}`}>
      <div className={isOpen ? 'flex items-center gap-2' : 'flex flex-col items-center gap-2'}>
        <button
          onClick={onNewChat}
          className={`flex items-center justify-center rounded-2xl text-sm font-semibold transition-all ${
            isOpen
              ? 'min-h-10 min-w-0 flex-1 gap-2 px-4 rounded-[18px]'
              : 'h-10 w-10'
          } bg-[#0A2540] text-white shadow-[0_10px_24px_rgba(10,37,64,0.18)] hover:bg-[#0D2F4D] dark:bg-accent dark:text-on-accent dark:shadow-[0_10px_24px_rgba(0,212,179,0.16)] dark:hover:bg-[#22E0C3]`}
          title="Nuevo Chat"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          {isOpen && <span>Nuevo Chat</span>}
        </button>
        <button
          onClick={onCreateFolderClick}
          className={`flex items-center justify-center rounded-2xl border border-gray-200/80 bg-white/70 text-secondary transition-all hover:border-[#0A2540]/20 hover:bg-[#0A2540]/10 hover:text-[#0A2540] dark:border-white/[0.07] dark:bg-white/[0.04] dark:text-white/50 dark:hover:border-accent/20 dark:hover:bg-accent/10 dark:hover:text-accent ${
            isOpen ? 'min-h-10 w-11 shrink-0 px-0 rounded-[18px]' : 'h-10 w-10'
          }`}
          title="Nueva Carpeta"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 10.5v6m3-3H9m4.06-7.19l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
          </svg>
        </button>
      </div>

      {isOpen ? (
        <button
          onClick={onOpenSearch}
          className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border border-gray-200/50 bg-white/20 text-left text-xs font-semibold text-secondary/70 transition-all hover:bg-gray-50/50 hover:text-gray-900 dark:border-white/[0.05] dark:bg-white/[0.02] dark:text-white/40 dark:hover:bg-white/[0.04] dark:hover:text-white/70"
        >
          <svg className="w-3.5 h-3.5 text-secondary/50 dark:text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <circle cx="11" cy="11" r="8" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35" />
          </svg>
          <span>Buscar chats...</span>
        </button>
      ) : (
        <button
          onClick={onOpenSearch}
          className="h-10 w-10 flex items-center justify-center rounded-2xl border border-gray-200/50 bg-white/20 text-secondary transition-all hover:bg-gray-50/50 dark:border-white/[0.05] dark:bg-white/[0.02] dark:text-white/40 dark:hover:bg-white/[0.04]"
          title="Buscar chats"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <circle cx="11" cy="11" r="8" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35" />
          </svg>
        </button>
      )}
    </div>
  );
}
