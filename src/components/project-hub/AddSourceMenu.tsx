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
        className="w-full py-2.5 bg-accent/5 hover:bg-accent/10 text-accent text-[11px] font-semibold uppercase tracking-[0.15em] rounded-xl transition-all flex items-center justify-center gap-2 border border-accent/10 hover:border-accent/15"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
        Agregar Fuente
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={onToggle} />
          <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-[#161B22] border border-gray-200 dark:border-white/[0.08] rounded-xl shadow-xl overflow-hidden z-20 backdrop-blur-xl">
            <button
              onClick={onOpenDrivePicker}
              className="w-full flex items-center gap-3 px-4.5 py-3 text-left hover:bg-gray-50 dark:hover:bg-white/[0.04] transition-all"
            >
              <div className="text-accent">{sourceTypeIcon('drive')}</div>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-700 dark:text-white/70">Google Drive</span>
            </button>
            <div className="h-px bg-gray-100 dark:bg-white/[0.06]" />
            <button
              onClick={onUploadClick}
              className="w-full flex items-center gap-3 px-4.5 py-3 text-left hover:bg-gray-50 dark:hover:bg-white/[0.04] transition-all"
            >
              <div className="text-accent">{sourceTypeIcon('upload')}</div>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-700 dark:text-white/70">Subir Archivo</span>
            </button>
          </div>
        </>
      )}

      <input ref={fileInputRef} type="file" className="hidden" onChange={onFileUpload} />
    </div>
  );
}
