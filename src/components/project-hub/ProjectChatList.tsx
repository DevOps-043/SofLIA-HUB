import type React from 'react';
import type { Conversation } from '../../services/chat-service';
import { formatDate, getInitials } from './formatters';

interface ProjectChatListProps {
  chats: Conversation[];
  editingChatTitle: string;
  renamingChatId: string | null;
  onDeleteChat: (chatId: string, event: React.MouseEvent) => void;
  onOpenChat: (chatId: string) => void;
  onSaveChatTitle: (chatId: string) => void;
  onSetEditingChatTitle: (title: string) => void;
  onSetRenamingChatId: (chatId: string | null) => void;
}

export function ProjectChatList(props: ProjectChatListProps) {
  if (props.chats.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 opacity-20 text-center">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
        </svg>
        <p className="text-[10px] font-black uppercase tracking-widest">Sin conversaciones aun</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {props.chats.map((chat) => (
        <div key={chat.id} onClick={() => props.onOpenChat(chat.id)} className="group flex items-center justify-between p-3 hover:bg-primary/5 dark:hover:bg-white/[0.03] rounded-2xl cursor-pointer transition-all border border-transparent hover:border-gray-200 dark:hover:border-white/5">
          <div className="flex items-center gap-4 flex-1 min-w-0">
            <div className="w-9 h-9 rounded-full bg-accent/10 flex items-center justify-center text-accent text-[11px] font-black uppercase ring-1 ring-accent/20">{getInitials(chat.title)}</div>
            <div className="flex-1 min-w-0">
              {props.renamingChatId === chat.id ? (
                <input autoFocus type="text" className="w-full bg-white dark:bg-[#1E1E1E] border border-accent rounded px-2 py-0.5 text-sm font-medium text-gray-900 dark:text-white outline-none mb-1" value={props.editingChatTitle} onChange={(e) => props.onSetEditingChatTitle(e.target.value)} onBlur={() => props.onSaveChatTitle(chat.id)} onClick={(e) => e.stopPropagation()} onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === 'Enter') props.onSaveChatTitle(chat.id);
                  if (e.key === 'Escape') props.onSetRenamingChatId(null);
                }} />
              ) : (
                <>
                  <h3 className="text-[14px] font-bold text-primary dark:text-gray-100 truncate">{chat.title}</h3>
                  {chat.is_shared && (
                    <div className={`mt-1 inline-flex rounded-full border px-2 py-0.5 text-[8px] font-black uppercase tracking-[0.18em] ${chat.can_share ? 'border-accent/20 bg-accent/10 text-accent' : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-500 animate-pulse'}`}>
                      {chat.can_share ? 'Compartido' : 'Recibido'}
                    </div>
                  )}
                </>
              )}
              <p className="text-[12px] text-gray-400 dark:text-gray-500 truncate mt-0.5 italic">Retomar conversacion...</p>
            </div>
          </div>
          <div className="flex items-center gap-6 ml-4 shrink-0">
            <span className="text-[11px] text-gray-400 dark:text-gray-600 font-bold uppercase tracking-tighter">{formatDate(chat.updated_at)}</span>
            <ChatActions chat={chat} onDeleteChat={props.onDeleteChat} onStartRename={() => {
              props.onSetRenamingChatId(chat.id);
              props.onSetEditingChatTitle(chat.title);
            }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function ChatActions({ chat, onDeleteChat, onStartRename }: { chat: Conversation; onDeleteChat: ProjectChatListProps['onDeleteChat']; onStartRename: (event: React.MouseEvent) => void }) {
  return (
    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
      {chat.can_edit && <button onClick={(event) => { event.stopPropagation(); onStartRename(event); }} className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-white/10 text-gray-400 hover:text-accent transition-all">Editar</button>}
      {chat.can_share && <button onClick={(event) => onDeleteChat(chat.id, event)} className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-white/10 text-gray-400 hover:text-danger transition-all">Eliminar</button>}
    </div>
  );
}
