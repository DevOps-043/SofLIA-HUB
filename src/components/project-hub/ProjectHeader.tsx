import type React from 'react';
import type { Folder } from '../../services/folder-service';

interface ProjectHeaderProps {
  canEditFolder: boolean;
  canShareFolder: boolean;
  chatsLength: number;
  editName: string;
  folder: Folder;
  folderSharedBadgeLabel: string;
  inputRef: React.RefObject<HTMLInputElement>;
  isEditing: boolean;
  onSaveName: () => void;
  onSetEditName: (value: string) => void;
  onSetIsEditing: (value: boolean) => void;
  onShareFolder?: () => void;
}

export function ProjectHeader({
  canEditFolder,
  canShareFolder,
  chatsLength,
  editName,
  folder,
  folderSharedBadgeLabel,
  inputRef,
  isEditing,
  onSaveName,
  onSetEditName,
  onSetIsEditing,
  onShareFolder,
}: ProjectHeaderProps) {
  return (
    <div className="flex flex-col items-center mb-8 text-center">
      {isEditing ? (
        <input
          ref={inputRef}
          type="text"
          value={editName}
          onChange={(e) => onSetEditName(e.target.value)}
          onBlur={onSaveName}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onSaveName();
            if (e.key === 'Escape') {
              onSetEditName(folder.name);
              onSetIsEditing(false);
            }
          }}
          className="text-2xl font-light tracking-wide bg-transparent border-b border-accent focus:outline-none text-primary dark:text-white text-center w-full max-w-md py-1"
        />
      ) : (
        <div className="flex flex-col items-center gap-2.5">
          <div className="flex flex-wrap items-center justify-center gap-2">
            <h1
              className={`text-2xl font-light tracking-wide text-primary dark:text-white transition-colors ${canShareFolder ? 'cursor-pointer hover:text-accent' : ''}`}
              onClick={() => canShareFolder && onSetIsEditing(true)}
            >
              {folder.name}
            </h1>
            {folder.is_shared && (
              <span className={`rounded-full border px-2.5 py-0.5 text-[9px] font-medium uppercase tracking-wider ${
                canShareFolder ? 'border-accent/15 bg-accent/5 text-accent' : 'border-emerald-500/15 bg-emerald-500/5 text-emerald-500 animate-pulse'
              }`}>
                {folderSharedBadgeLabel}
              </span>
            )}
          </div>
          {folder.is_shared && (
            <p className="text-[11.5px] font-light text-secondary/70 dark:text-white/40">
              {canEditFolder ? 'Tienes permiso para colaborar en esta carpeta.' : 'Esta carpeta esta en solo lectura para ti.'}
            </p>
          )}
          {canShareFolder && onShareFolder && (
            <button
              type="button"
              onClick={onShareFolder}
              className="inline-flex items-center gap-2 rounded-xl border border-accent/10 bg-accent/5 px-3.5 py-1.5 text-[9px] font-semibold uppercase tracking-wider text-accent transition-all hover:bg-accent/10"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
              </svg>
              Compartir carpeta
            </button>
          )}
        </div>
      )}
      <p className="text-[10px] text-secondary/50 dark:text-white/20 font-medium uppercase tracking-[0.15em] mt-1.5">
        {chatsLength} {chatsLength === 1 ? 'conversacion' : 'conversaciones'}
      </p>
    </div>
  );
}
