import { useEffect, useRef, useState } from 'react';
import { FolderModalShell } from './FolderModalShell';
import type { CreateFolderModalProps } from './types';

export function CreateFolderModal({ isOpen, onClose, onCreate }: CreateFolderModalProps) {
  const [name, setName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    setName('');
    setTimeout(() => inputRef.current?.focus(), 100);
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCreate = () => {
    if (!name.trim()) return;
    onCreate(name.trim());
    setName('');
    onClose();
  };

  return (
    <FolderModalShell onClose={onClose}>
      <div className="relative z-10 px-8 pt-10 pb-4 flex flex-col items-center text-center">
        <div className="w-14 h-14 rounded-2xl bg-accent/10 flex items-center justify-center border border-accent/20 mb-4 shadow-lg shadow-accent/5">
          <svg className="w-7 h-7 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 10.5v6m3-3H9m4.06-7.19l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 4.5v15a2.25 2.25 0 002.25 2.25h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-3.939a1.5 1.5 0 01-1.06-.44l-2.122-2.12z" />
          </svg>
        </div>
        <h3 className="text-gray-900 dark:text-white text-lg font-black uppercase tracking-widest leading-none">Nueva Unidad</h3>
        <p className="text-[10px] text-gray-500 dark:text-gray-400 font-bold uppercase tracking-widest mt-2 px-4 opacity-60">Organizacion de Capas de Datos</p>
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
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && handleCreate()}
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
    </FolderModalShell>
  );
}
