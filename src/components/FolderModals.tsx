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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-white dark:bg-card-dark rounded-xl shadow-xl w-full max-w-sm mx-4 animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 pt-5 pb-2">
          <h3 className="text-base font-semibold text-primary dark:text-white">Nueva Carpeta</h3>
          <p className="text-xs text-secondary mt-1">Organiza tus conversaciones en proyectos</p>
        </div>

        <div className="px-5 py-3">
          <input
            ref={inputRef}
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            placeholder="Nombre de la carpeta..."
            className="w-full px-3 py-2.5 text-sm bg-background dark:bg-background-dark border border-gray-200 dark:border-white/10 rounded-lg focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/20 text-primary dark:text-white placeholder-gray-400"
          />
        </div>

        <div className="flex justify-end gap-2 px-5 pb-5">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-secondary hover:text-primary dark:hover:text-white rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleCreate}
            disabled={!name.trim()}
            className="px-4 py-2 text-sm bg-accent text-white rounded-lg hover:bg-accent/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Crear
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-white dark:bg-card-dark rounded-xl shadow-xl w-full max-w-sm mx-4 animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 pt-5 pb-2">
          <h3 className="text-base font-semibold text-primary dark:text-white">Mover a carpeta</h3>
          <p className="text-xs text-secondary mt-1">Selecciona donde mover esta conversacion</p>
        </div>

        <div className="px-3 py-2 max-h-64 overflow-y-auto no-scrollbar">
          {/* Remove from folder option */}
          <button
            onClick={() => handleMove(null)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
              !currentFolderId
                ? 'bg-accent/10 text-accent'
                : 'text-primary dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5'
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8" />
            </svg>
            Sin carpeta
          </button>

          {/* Folder list */}
          {folders.map(folder => (
            <button
              key={folder.id}
              onClick={() => handleMove(folder.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                currentFolderId === folder.id
                  ? 'bg-accent/10 text-accent'
                  : 'text-primary dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5'
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
              {folder.name}
            </button>
          ))}

          {folders.length === 0 && (
            <p className="px-3 py-4 text-center text-xs text-secondary">
              No hay carpetas. Crea una primero.
            </p>
          )}
        </div>

        <div className="flex justify-end px-5 pb-5 pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-secondary hover:text-primary dark:hover:text-white rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
};
