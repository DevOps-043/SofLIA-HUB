import type { ChangeEvent, RefObject } from 'react';
import { sourceTypeIcon } from './formatters';

interface AddSourceMenuProps {
  fileInputRef: RefObject<HTMLInputElement>;
  isOpen: boolean;
  onFileUpload: (event: ChangeEvent<HTMLInputElement>) => void;
  onOpenDrivePicker: () => void;
  onToggle: () => void;
  onUploadClick: () => void;
}

export function AddSourceMenu({
  fileInputRef,
  isOpen,
  onFileUpload,
  onOpenDrivePicker,
  onToggle,
  onUploadClick,
}: AddSourceMenuProps) {
  return (
    <div className="relative mb-6">
      <button
        onClick={onToggle}
        className="w-full py-3.5 bg-accent/5 hover:bg-accent/10 text-accent text-[11px] font-black uppercase tracking-[0.2em] rounded-2xl transition-all flex items-center justify-center gap-2.5 border border-accent/10 hover:border-accent/20"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
        Agregar Fuente
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={onToggle} />
          <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-[#1a1b1e] border border-gray-200 dark:border-white/10 rounded-2xl shadow-xl overflow-hidden z-20">
            <button
              onClick={onOpenDrivePicker}
              className="w-full flex items-center gap-3 px-5 py-3.5 text-left hover:bg-gray-50 dark:hover:bg-white/5 transition-all"
            >
              <div className="text-accent">{sourceTypeIcon('drive')}</div>
              <span className="text-[11px] font-bold uppercase tracking-widest text-gray-700 dark:text-gray-300">Google Drive</span>
            </button>
            <div className="h-px bg-gray-100 dark:bg-white/5" />
            <button
              onClick={onUploadClick}
              className="w-full flex items-center gap-3 px-5 py-3.5 text-left hover:bg-gray-50 dark:hover:bg-white/5 transition-all"
            >
              <div className="text-accent">{sourceTypeIcon('upload')}</div>
              <span className="text-[11px] font-bold uppercase tracking-widest text-gray-700 dark:text-gray-300">Subir Archivo</span>
            </button>
          </div>
        </>
      )}

      <input ref={fileInputRef} type="file" className="hidden" onChange={onFileUpload} />
    </div>
  );
}
