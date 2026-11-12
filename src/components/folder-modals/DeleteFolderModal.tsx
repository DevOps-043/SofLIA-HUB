import { useCallback, useEffect, useState } from 'react';
import { FolderModalShell } from './FolderModalShell';
import type { DeleteFolderModalProps } from './types';

export function DeleteFolderModal({
  isOpen,
  folder,
  onClose,
  onConfirm,
  isDeleting = false,
}: DeleteFolderModalProps) {
  const [internalBusy, setInternalBusy] = useState(false);
  const busy = isDeleting || internalBusy;

  const handleConfirm = useCallback(async () => {
    if (busy) return;
    setInternalBusy(true);
    try {
      await onConfirm();
    } finally {
      setInternalBusy(false);
    }
  }, [busy, onConfirm]);

  useEffect(() => {
    if (!isOpen || !folder) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Enter' && !busy) {
        event.preventDefault();
        void handleConfirm();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, folder, busy, handleConfirm]);

  if (!isOpen || !folder) return null;

  const nombre = folder.name ? `"${folder.name}"` : 'esta carpeta';

  const handleClose = () => {
    if (busy) return;
    onClose();
  };

  return (
    <FolderModalShell onClose={handleClose} glowColor="danger" maxWidthClass="max-w-md">
      <div className="relative z-10 px-8 pt-10 pb-3 flex flex-col items-center text-center">
        <div className="w-14 h-14 rounded-2xl bg-danger/10 flex items-center justify-center border border-danger/20 mb-4 shadow-lg shadow-danger/5">
          <svg
            className="w-7 h-7 text-danger"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.75}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
            />
          </svg>
        </div>
        <h3 className="text-gray-900 dark:text-white text-lg font-black uppercase tracking-widest leading-snug break-words max-w-full px-2">
          Eliminar {nombre}?
        </h3>
        <p className="text-[10px] text-danger/80 dark:text-danger/90 font-bold uppercase tracking-widest mt-1.5 px-4 opacity-80">
          Confirmación requerida
        </p>
      </div>

      <div className="relative z-10 px-8 py-3">
        <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-gray-50/70 dark:bg-black/30 p-4 text-[13px] leading-relaxed text-gray-600 dark:text-gray-300">
          <p>
            Sus chats se conservan y pasan a <span className="font-semibold text-gray-900 dark:text-white">&quot;Sin carpeta&quot;</span>. Las fuentes de la carpeta y los accesos compartidos se eliminan.
          </p>
        </div>
      </div>

      <div className="relative z-10 grid grid-cols-2 gap-3 px-8 pb-8 pt-3">
        <button
          type="button"
          onClick={handleClose}
          disabled={busy}
          className="w-full py-3 bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 text-gray-700 dark:text-gray-300 text-[11px] font-black uppercase tracking-widest rounded-2xl border border-gray-200 dark:border-white/10 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-40 disabled:scale-100"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={() => void handleConfirm()}
          disabled={busy}
          className="w-full py-3 bg-danger hover:bg-danger/90 text-white text-[11px] font-black uppercase tracking-widest rounded-2xl hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-40 disabled:scale-100 shadow-xl shadow-danger/20"
        >
          {busy ? 'Eliminando...' : 'Eliminar'}
        </button>
      </div>
    </FolderModalShell>
  );
}
