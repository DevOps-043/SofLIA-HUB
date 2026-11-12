import { NewChatIcon, NewFolderIcon, SearchIcon } from '../ui/Icons';

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
          <NewChatIcon size={isOpen ? 17 : 20} className="shrink-0" />
          {isOpen && <span className="truncate">Nuevo Chat</span>}
        </button>

        <button
          type="button"
          onClick={onCreateFolderClick}
          aria-label="Nueva Carpeta"
          className="flex h-10.5 w-10.5 shrink-0 items-center justify-center rounded-xl text-gray-400 dark:text-white/50 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100/80 dark:hover:bg-white/[0.08] transition-all duration-150"
          title="Nueva Carpeta"
        >
          <NewFolderIcon size={20} className="shrink-0" />
        </button>
      </div>

      {isOpen ? (
        <button
          type="button"
          onClick={onOpenSearch}
          className="w-full h-8.5 flex items-center gap-2 px-3 rounded-xl border border-gray-200/60 dark:border-white/10 bg-white/60 dark:bg-white/[0.03] text-left text-xs font-medium text-gray-500 dark:text-white/40 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100/70 dark:hover:bg-white/[0.06] transition-all duration-150"
        >
          <SearchIcon size={14} className="text-gray-400 dark:text-white/35 shrink-0" />
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
          <SearchIcon size={20} className="shrink-0" />
        </button>
      )}
    </div>
  );
}

