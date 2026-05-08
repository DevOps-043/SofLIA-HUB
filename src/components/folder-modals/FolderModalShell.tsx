import type { ReactNode } from 'react';

interface FolderModalShellProps {
  onClose: () => void;
  children: ReactNode;
}

export function FolderModalShell({ onClose, children }: FolderModalShellProps) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="relative bg-white dark:bg-[#1a1b1e]/90 border border-gray-200 dark:border-white/10 rounded-3xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden animate-in zoom-in-95 duration-300"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="absolute top-0 right-0 w-32 h-32 bg-accent/5 blur-[60px] pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-blue-500/5 blur-[60px] pointer-events-none" />
        <div className="absolute top-4 right-4 z-20">
          <CloseButton onClose={onClose} />
        </div>
        {children}
      </div>
    </div>
  );
}

function CloseButton({ onClose }: { onClose: () => void }) {
  return (
    <button onClick={onClose} className="w-8 h-8 rounded-full bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 flex items-center justify-center text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-all group">
      <svg className="w-4 h-4 transition-transform group-hover:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
      </svg>
    </button>
  );
}
