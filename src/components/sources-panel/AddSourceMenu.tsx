import { SourceIcon } from './SourceIcon';

interface AddSourceMenuProps {
  showMenu: boolean;
  onToggleMenu: () => void;
  onOpenDrive: () => void;
  onOpenUpload: () => void;
}

export function AddSourceMenu({ showMenu, onToggleMenu, onOpenDrive, onOpenUpload }: AddSourceMenuProps) {
  const handleOpenDrive = () => {
    onToggleMenu();
    onOpenDrive();
  };
  const handleOpenUpload = () => {
    onToggleMenu();
    onOpenUpload();
  };

  return (
    <div className="relative z-10 px-8 pb-2">
      <div className="relative">
        <button onClick={onToggleMenu} className="w-full py-3 bg-accent/10 text-accent text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl hover:bg-accent/20 transition-all flex items-center justify-center gap-2 border border-accent/10">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Agregar Fuente
        </button>

        {showMenu && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-[#1a1b1e] border border-gray-200 dark:border-white/10 rounded-2xl shadow-xl overflow-hidden z-30">
            <button onClick={handleOpenDrive} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-black/5 dark:hover:bg-white/5 transition-all">
              <SourceIcon type="drive" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-gray-700 dark:text-gray-300">Google Drive</span>
            </button>
            <div className="h-px bg-gray-200 dark:bg-white/5" />
            <button onClick={handleOpenUpload} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-black/5 dark:hover:bg-white/5 transition-all">
              <SourceIcon type="upload" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-gray-700 dark:text-gray-300">Subir Archivo</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
