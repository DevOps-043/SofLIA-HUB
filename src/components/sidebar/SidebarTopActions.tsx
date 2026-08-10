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
    <div
      className={`pb-1 pt-1 flex flex-col gap-2.5 ${isOpen ? 'px-3' : 'px-1.5 items-center'}`}
      style={{ fontFamily: 'var(--font-system-ui)' }}
    >
      <div className={isOpen ? 'flex items-center gap-1.5' : 'flex flex-col items-center gap-2.5'}>
        <button
          type="button"
          onClick={onNewChat}
          aria-label="Nuevo Chat"
          className={`flex items-center justify-center text-xs font-semibold transition-all duration-150 ${
            isOpen
              ? 'h-9 flex-1 gap-2 px-3.5 rounded-xl bg-accent/15 border border-accent/25 text-accent hover:bg-accent hover:text-on-accent shadow-2xs'
              : 'h-10.5 w-10.5 rounded-xl text-gray-700 dark:text-white/80 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100/80 dark:hover:bg-white/[0.08] active:scale-95'
          }`}
          title="Nuevo Chat"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className={isOpen ? 'h-4 w-4 shrink-0' : 'h-5.5 w-5.5 shrink-0'} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
          </svg>
          {isOpen && <span className="truncate">Nuevo Chat</span>}
        </button>

        <button
          type="button"
          onClick={onCreateFolderClick}
          aria-label="Nueva Carpeta"
          className="flex h-10.5 w-10.5 shrink-0 items-center justify-center rounded-xl text-gray-400 dark:text-white/50 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100/80 dark:hover:bg-white/[0.08] transition-all duration-150"
          title="Nueva Carpeta"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5.5 w-5.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 10.5v6m3-3H9m4.06-7.19l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
          </svg>
        </button>
      </div>

      {isOpen ? (
        <button
          type="button"
          onClick={onOpenSearch}
          className="w-full h-8.5 flex items-center gap-2 px-3 rounded-xl border border-gray-200/60 dark:border-white/10 bg-white/60 dark:bg-white/[0.03] text-left text-xs font-medium text-gray-500 dark:text-white/40 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100/70 dark:hover:bg-white/[0.06] transition-all duration-150"
        >
          <svg className="w-3.5 h-3.5 text-gray-400 dark:text-white/35 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <circle cx="11" cy="11" r="8" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35" />
          </svg>
          <span className="truncate">Buscar chats...</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={onOpenSearch}
          aria-label="Buscar chats"
          className="h-10.5 w-10.5 flex items-center justify-center rounded-xl text-gray-400 dark:text-white/50 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100/80 dark:hover:bg-white/[0.08] transition-all duration-150"
          title="Buscar chats"
        >
          <svg className="w-5.5 h-5.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
            <circle cx="11" cy="11" r="8" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35" />
          </svg>
        </button>
      )}
    </div>
  );
}

