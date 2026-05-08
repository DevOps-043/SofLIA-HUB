import { FolderModalShell } from './FolderModalShell';
import type { MoveChatModalProps } from './types';

export function MoveChatModal({ isOpen, onClose, folders, currentFolderId, onMove }: MoveChatModalProps) {
  if (!isOpen) return null;

  const handleMove = (folderId: string | null) => {
    onMove(folderId);
    onClose();
  };

  return (
    <FolderModalShell onClose={onClose}>
      <div className="relative z-10 px-8 pt-10 pb-2">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-1.5 h-6 bg-accent rounded-full shadow-[0_0_10px_rgba(34,211,238,0.5)]" />
          <div>
            <h3 className="text-gray-900 dark:text-white text-lg font-black uppercase tracking-widest leading-none">Relocalizar Nodo</h3>
            <p className="text-[10px] text-gray-500 dark:text-gray-400 font-bold uppercase tracking-widest mt-1 opacity-60">Seleccion de Destino de Archivo</p>
          </div>
        </div>
      </div>

      <div className="relative z-10 px-4 py-2 max-h-80 overflow-y-auto custom-scrollbar mb-10 mx-2">
        <div className="space-y-1.5">
          <MoveOption
            active={!currentFolderId}
            label="Capa Base (Sin Carpeta)"
            onClick={() => handleMove(null)}
            iconPath="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
          />
          <div className="h-px bg-white/5 my-2 mx-4" />
          {folders.map((folder) => (
            <MoveOption
              key={folder.id}
              active={currentFolderId === folder.id}
              label={folder.name}
              onClick={() => handleMove(folder.id)}
              iconPath="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
            />
          ))}
          {folders.length === 0 && <EmptyFolderState />}
        </div>
      </div>
    </FolderModalShell>
  );
}

function MoveOption({ active, label, onClick, iconPath }: { active: boolean; label: string; onClick: () => void; iconPath: string }) {
  const itemClass = active
    ? 'bg-accent/10 border border-accent/20 text-accent'
    : 'text-gray-500 dark:text-gray-400 border border-transparent hover:bg-black/5 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-white';
  const iconClass = active ? 'bg-accent/20' : 'bg-white/5 group-hover:bg-white/10';

  return (
    <button onClick={onClick} className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl text-[11px] font-bold uppercase tracking-widest transition-all group ${itemClass}`}>
      <div className={`p-2 rounded-lg transition-colors ${iconClass}`}>
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d={iconPath} />
        </svg>
      </div>
      {label}
    </button>
  );
}

function EmptyFolderState() {
  return (
    <div className="py-12 flex flex-col items-center justify-center opacity-30">
      <svg className="w-10 h-10 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
        <path d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197" />
      </svg>
      <p className="text-[10px] font-black uppercase tracking-widest">Sin Sectores Disponibles</p>
    </div>
  );
}
