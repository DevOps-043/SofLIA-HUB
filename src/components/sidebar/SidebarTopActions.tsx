export function SidebarTopActions({
  isOpen,
  onNewChat,
  onCreateFolderClick,
}: {
  isOpen: boolean;
  onNewChat: () => void;
  onCreateFolderClick: () => void;
}) {
  return (
    <div className="px-2 py-2 space-y-1">
      <button
        onClick={onNewChat}
        className={`w-full flex items-center ${isOpen ? 'gap-3 px-3' : 'justify-center px-0'} py-2 rounded-lg border border-gray-200 dark:border-white/20 bg-white dark:bg-transparent hover:bg-gray-100 dark:hover:bg-[#2A2B32] transition-colors text-sm shadow-sm dark:shadow-none`}
        title="Nuevo Chat"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
        {isOpen && <span>Nuevo Chat</span>}
      </button>
      <button
        onClick={onCreateFolderClick}
        className={`w-full flex items-center ${isOpen ? 'gap-3 px-3' : 'justify-center px-0'} py-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#2A2B32] hover:text-gray-900 dark:hover:text-white transition-colors text-sm`}
        title="Nueva Carpeta"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 10.5v6m3-3H9m4.06-7.19l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
        </svg>
        {isOpen && <span>Nueva Carpeta</span>}
      </button>
    </div>
  );
}
