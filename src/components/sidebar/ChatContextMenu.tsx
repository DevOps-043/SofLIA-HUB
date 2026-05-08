type ChatContextMenuProps = {
  canRename: boolean;
  canMove: boolean;
  canDelete: boolean;
  onRename: () => void;
  onMove: () => void;
  onDelete: (event: React.MouseEvent) => void;
  onClose: () => void;
};

export function ChatContextMenu({
  canRename,
  canMove,
  canDelete,
  onRename,
  onMove,
  onDelete,
  onClose,
}: ChatContextMenuProps) {
  const hasActions = canRename || canMove || canDelete;
  if (!hasActions) return null;

  return (
    <div className="absolute right-0 mt-2 w-40 bg-white/95 dark:bg-[#1E1E1E]/95 backdrop-blur-md border border-gray-200 dark:border-white/10 rounded-xl shadow-2xl z-50 py-2 animate-in fade-in zoom-in-95 duration-150 ring-1 ring-black/5">
      {canRename && (
        <button
          onClick={(event) => { event.stopPropagation(); onRename(); onClose(); }}
          className="w-full text-left px-3 py-2 text-[12.5px] text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5 flex items-center gap-3 transition-colors group/item"
        >
          <div className="w-6 h-6 rounded-md bg-gray-100 dark:bg-white/5 flex items-center justify-center group-hover/item:text-accent group-hover/item:bg-accent/10 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </div>
          <span>Renombrar</span>
        </button>
      )}

      {canMove && (
        <button
          onClick={(event) => { event.stopPropagation(); onMove(); onClose(); }}
          className="w-full text-left px-3 py-2 text-[12.5px] text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5 flex items-center gap-3 transition-colors group/item"
        >
          <div className="w-6 h-6 rounded-md bg-gray-100 dark:bg-white/5 flex items-center justify-center group-hover/item:text-accent group-hover/item:bg-accent/10 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
            </svg>
          </div>
          <span>Mover</span>
        </button>
      )}

      {canDelete && <div className="h-px bg-gray-100 dark:bg-white/5 my-1.5 mx-2" />}

      {canDelete && (
        <button
          onClick={(event) => { event.stopPropagation(); onDelete(event); onClose(); }}
          className="w-full text-left px-3 py-2 text-[12.5px] text-danger hover:bg-danger/10 flex items-center gap-3 transition-colors group/item"
        >
          <div className="w-6 h-6 rounded-md bg-danger/5 flex items-center justify-center text-danger/70 group-hover/item:text-danger group-hover/item:bg-danger/20 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </div>
          <span className="font-medium">Eliminar</span>
        </button>
      )}
    </div>
  );
}
