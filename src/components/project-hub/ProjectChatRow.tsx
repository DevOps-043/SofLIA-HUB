import type { MouseEvent } from 'react';
import type { Conversation } from '../../services/chat-service';
import { formatDate, getInitials } from './formatters';

interface ProjectChatRowProps {
  chat: Conversation;
  editingChatTitle: string;
  renamingChatId: string | null;
  onDeleteChat: (chatId: string, event: MouseEvent) => void;
  onOpenChat: (chatId: string) => void;
  onSaveChatTitle: (chatId: string) => void;
  onSetEditingChatTitle: (title: string) => void;
  onSetRenamingChatId: (chatId: string | null) => void;
  onStartRenamingChat: (chatId: string, title: string) => void;
}

export function ProjectChatRow(props: ProjectChatRowProps) {
  const {
    chat, editingChatTitle, renamingChatId, onDeleteChat, onOpenChat,
    onSaveChatTitle, onSetEditingChatTitle, onSetRenamingChatId, onStartRenamingChat,
  } = props;

  return (
    <div
      onClick={() => onOpenChat(chat.id)}
      className="group flex items-center justify-between p-3 hover:bg-primary/5 dark:hover:bg-white/[0.03] rounded-2xl cursor-pointer transition-all border border-transparent hover:border-gray-200 dark:hover:border-white/5"
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className="w-8 h-8 rounded-full bg-accent/5 flex items-center justify-center text-accent text-[10px] font-semibold uppercase ring-1 ring-accent/10">
          {getInitials(chat.title)}
        </div>
        <div className="flex-1 min-w-0">
          {renamingChatId === chat.id ? (
            <input
              autoFocus
              type="text"
              className="w-full bg-white dark:bg-[#1E1E1E] border border-accent rounded px-2 py-0.5 text-sm font-medium text-gray-900 dark:text-white outline-none mb-1"
              value={editingChatTitle}
              onChange={(event) => onSetEditingChatTitle(event.target.value)}
              onBlur={() => onSaveChatTitle(chat.id)}
              onClick={(event) => event.stopPropagation()}
              onKeyDown={(event) => {
                event.stopPropagation();
                if (event.key === 'Enter') onSaveChatTitle(chat.id);
                else if (event.key === 'Escape') onSetRenamingChatId(null);
              }}
            />
          ) : (
            <>
              <h3 className="text-[13px] font-light tracking-wide text-primary dark:text-gray-100 truncate">{chat.title}</h3>
              {chat.is_shared && (
                <div className={`mt-1 inline-flex rounded-md border px-2 py-0.5 text-[8px] font-semibold uppercase tracking-[0.12em] ${chat.can_share ? 'border-accent/15 bg-accent/5 text-accent' : 'border-emerald-500/15 bg-emerald-500/5 text-emerald-500 animate-pulse'}`}>
                  {chat.can_share ? 'Compartido' : 'Recibido'}
                </div>
              )}
            </>
          )}
          <p className="text-[11.5px] font-light text-secondary/60 dark:text-white/20 truncate mt-0.5">Retomar conversación...</p>
        </div>
      </div>
      <div className="flex items-center gap-6 ml-4 shrink-0">
        <span className="text-[10px] text-secondary/50 dark:text-white/20 font-light tracking-wider uppercase">
          {formatDate(chat.updated_at)}
        </span>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
          {chat.can_edit && (
            <button onClick={(event) => { event.stopPropagation(); onStartRenamingChat(chat.id, chat.title); }} className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-white/10 text-gray-400 hover:text-accent transition-all">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </button>
          )}
          {chat.can_share && (
            <button onClick={(event) => onDeleteChat(chat.id, event)} className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-white/10 text-gray-400 hover:text-danger transition-all">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
