import React, { useState, useEffect, useRef } from 'react';
import type { Folder } from '../services/folder-service';

// ============================================
// Create Folder Modal
// ============================================

interface CreateFolderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (name: string) => void;
}

export const CreateFolderModal: React.FC<CreateFolderModalProps> = ({ isOpen, onClose, onCreate }) => {
  const [name, setName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setName('');
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCreate = () => {
    if (name.trim()) {
      onCreate(name.trim());
      setName('');
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="relative bg-white dark:bg-[#1a1b1e]/90 border border-gray-200 dark:border-white/10 rounded-3xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden animate-in zoom-in-95 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Ambient Glows */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-accent/5 blur-[60px] pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-blue-500/5 blur-[60px] pointer-events-none" />

        <div className="absolute top-4 right-4 z-20">
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 flex items-center justify-center text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-all group">
            <svg className="w-4 h-4 transition-transform group-hover:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="relative z-10 px-8 pt-10 pb-4 flex flex-col items-center text-center">
          <div className="w-14 h-14 rounded-2xl bg-accent/10 flex items-center justify-center border border-accent/20 mb-4 shadow-lg shadow-accent/5">
            <svg className="w-7 h-7 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 10.5v6m3-3H9m4.06-7.19l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 4.5v15a2.25 2.25 0 002.25 2.25h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-3.939a1.5 1.5 0 01-1.06-.44l-2.122-2.12z" />
            </svg>
          </div>
          <h3 className="text-gray-900 dark:text-white text-lg font-black uppercase tracking-widest leading-none">Nueva Unidad</h3>
          <p className="text-[10px] text-gray-500 dark:text-gray-400 font-bold uppercase tracking-widest mt-2 px-4 opacity-60">Organización de Capas de Datos</p>
        </div>

        <div className="relative z-10 px-8 py-4">
          <div className="relative group">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 transition-colors group-focus-within:text-accent text-gray-600">
               <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                 <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
               </svg>
            </div>
            <input
              ref={inputRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              placeholder="ETIQUETA DE CARPETA..."
              className="w-full pl-11 pr-4 py-3.5 bg-gray-100/50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-2xl text-[12px] font-bold text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-700 focus:outline-none focus:border-accent/30 focus:ring-4 focus:ring-accent/5 transition-all text-center uppercase tracking-widest"
            />
          </div>
        </div>

        <div className="relative z-10 flex flex-col gap-2 px-8 pb-10 pt-2">
          <button
            onClick={handleCreate}
            disabled={!name.trim()}
            className="w-full py-3 bg-accent text-white text-[11px] font-black uppercase tracking-[0.2em] rounded-2xl hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-40 disabled:scale-100 shadow-xl shadow-accent/10"
          >
            Inicializar Directorio
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================
// Move Chat to Folder Modal
// ============================================

interface MoveChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  folders: Folder[];
  currentFolderId: string | null | undefined;
  onMove: (folderId: string | null) => void;
}

export const MoveChatModal: React.FC<MoveChatModalProps> = ({ isOpen, onClose, folders, currentFolderId, onMove }) => {
  if (!isOpen) return null;

  const handleMove = (folderId: string | null) => {
    onMove(folderId);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="relative bg-white dark:bg-[#1a1b1e]/90 border border-gray-200 dark:border-white/10 rounded-3xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden animate-in zoom-in-95 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Ambient Glows */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-accent/5 blur-[60px] pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-blue-500/5 blur-[60px] pointer-events-none" />

        <div className="absolute top-4 right-4 z-20">
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 flex items-center justify-center text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-all group">
            <svg className="w-4 h-4 transition-transform group-hover:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="relative z-10 px-8 pt-10 pb-2">
           <div className="flex items-center gap-3 mb-4">
              <div className="w-1.5 h-6 bg-accent rounded-full shadow-[0_0_10px_rgba(34,211,238,0.5)]" />
              <div>
                <h3 className="text-gray-900 dark:text-white text-lg font-black uppercase tracking-widest leading-none">Relocalizar Nodo</h3>
                <p className="text-[10px] text-gray-500 dark:text-gray-400 font-bold uppercase tracking-widest mt-1 opacity-60">Selección de Destino de Archivo</p>
              </div>
           </div>
        </div>

        <div className="relative z-10 px-4 py-2 max-h-80 overflow-y-auto custom-scrollbar mb-10 mx-2">
          <div className="space-y-1.5">
            {/* Remove from folder option */}
            <button
              onClick={() => handleMove(null)}
              className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl text-[11px] font-bold uppercase tracking-widest transition-all group ${
                !currentFolderId
                  ? 'bg-accent/10 border border-accent/20 text-accent'
                  : 'text-gray-500 dark:text-gray-400 border border-transparent hover:bg-black/5 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <div className={`p-2 rounded-lg transition-colors ${!currentFolderId ? 'bg-accent/20' : 'bg-white/5 group-hover:bg-white/10'}`}>
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              Capa Base (Sin Carpeta)
            </button>

            <div className="h-px bg-white/5 my-2 mx-4" />

            {/* Folder list */}
            {folders.map(folder => (
              <button
                key={folder.id}
                onClick={() => handleMove(folder.id)}
                className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl text-[11px] font-bold uppercase tracking-widest transition-all group ${
                  currentFolderId === folder.id
                    ? 'bg-accent/10 border border-accent/20 text-accent'
                    : 'text-gray-500 dark:text-gray-400 border border-transparent hover:bg-black/5 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <div className={`p-2 rounded-lg transition-colors ${currentFolderId === folder.id ? 'bg-accent/20' : 'bg-white/5 group-hover:bg-white/10'}`}>
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                  </svg>
                </div>
                {folder.name}
              </button>
            ))}

            {folders.length === 0 && (
              <div className="py-12 flex flex-col items-center justify-center opacity-30">
                 <svg className="w-10 h-10 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                    <path d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197" />
                 </svg>
                 <p className="text-[10px] font-black uppercase tracking-widest">Sin Sectores Disponibles</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
