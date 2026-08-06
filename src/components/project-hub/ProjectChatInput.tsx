import type React from 'react';

interface ProjectChatInputProps {
  canEditFolder: boolean;
  chatInput: string;
  chatInputRef: React.RefObject<HTMLInputElement | null>;
  folderName: string;
  onSetChatInput: (value: string) => void;
  onSubmit: () => void;
}

export function ProjectChatInput({
  canEditFolder,
  chatInput,
  chatInputRef,
  folderName,
  onSetChatInput,
  onSubmit,
}: ProjectChatInputProps) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      className="w-full relative group mb-12"
    >
      <div className={`w-full px-4.5 py-0.5 backdrop-blur-xl border rounded-xl flex items-center gap-3.5 shadow-sm transition-all duration-300 ${canEditFolder ? 'bg-gray-50/20 dark:bg-white/[0.01] border-gray-200/50 dark:border-white/[0.06] focus-within:border-accent/30 focus-within:ring-4 focus-within:ring-accent/5' : 'bg-gray-100/40 dark:bg-white/[0.005] border-gray-200/40 dark:border-white/[0.03] opacity-60'}`}>
        <div className="text-gray-400 dark:text-gray-500">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
        </div>
        <input
          ref={chatInputRef}
          type="text"
          value={chatInput}
          onChange={(e) => onSetChatInput(e.target.value)}
          placeholder={canEditFolder ? `Mensaje en ${folderName}...` : `Solo lectura en ${folderName}`}
          className="flex-1 bg-transparent text-[13px] font-light tracking-wide text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-white/20 focus:outline-none py-3"
          disabled={!canEditFolder}
        />
        <div className="flex items-center gap-2 text-gray-300 dark:text-gray-600">
          {canEditFolder && chatInput.trim() ? (
            <button type="submit" className="p-1.5 bg-accent rounded-lg text-white hover:bg-accent/80 transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </button>
          ) : !canEditFolder ? (
            <div className="rounded-lg bg-gray-100 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-wider text-gray-500 dark:bg-white/[0.04] dark:text-white/40 border border-gray-200/50 dark:border-white/[0.04]">
              Solo lectura
            </div>
          ) : null}
        </div>
      </div>
    </form>
  );
}
