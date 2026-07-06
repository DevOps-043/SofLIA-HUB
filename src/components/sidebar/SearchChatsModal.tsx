import { useState, useMemo } from 'react';
import type { Conversation } from '../../services/chat-service';

interface SearchChatsModalProps {
  isOpen: boolean;
  onClose: () => void;
  conversations: Conversation[];
  onSelectConversation: (id: string) => void;
  onNewChat: () => void;
}

export function SearchChatsModal({
  isOpen,
  onClose,
  conversations,
  onSelectConversation,
  onNewChat,
}: SearchChatsModalProps) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return conversations;
    return conversations.filter((c) => c.title.toLowerCase().includes(trimmed));
  }, [conversations, query]);

  const grouped = useMemo(() => {
    const groups: Record<string, Conversation[]> = {
      Hoy: [],
      Ayer: [],
      'Hace 7 dias': [],
      Anteriores: [],
    };

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfYesterday = startOfToday - 24 * 60 * 60 * 1000;
    const startOfSevenDaysAgo = startOfToday - 7 * 24 * 60 * 60 * 1000;

    for (const conv of filtered) {
      const time = new Date(conv.updated_at || conv.created_at).getTime();
      if (time >= startOfToday) {
        groups.Hoy.push(conv);
      } else if (time >= startOfYesterday) {
        groups.Ayer.push(conv);
      } else if (time >= startOfSevenDaysAgo) {
        groups['Hace 7 dias'].push(conv);
      } else {
        groups.Anteriores.push(conv);
      }
    }

    return Object.entries(groups).filter(([_, items]) => items.length > 0);
  }, [filtered]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-100 flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={onClose}>
      <div 
        className="w-full max-w-md bg-white dark:bg-[#161B22] border border-gray-200 dark:border-white/[0.08] rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[70vh] relative animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Search Input */}
        <div className="relative group flex-shrink-0">
          <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-accent transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <circle cx="11" cy="11" r="8" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35" />
          </svg>
          <input
            type="text"
            placeholder="Buscar chats..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-transparent border-b border-gray-100 dark:border-white/[0.06] pl-11 pr-10 py-4 text-[13px] font-light text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-0 transition-all duration-200"
            autoFocus
          />
          {query ? (
            <button onClick={() => setQuery('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          ) : (
            <button onClick={onClose} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors text-xs font-semibold">
              Esc
            </button>
          )}
        </div>

        {/* Scrollable Area */}
        <div className="flex-1 overflow-y-auto no-scrollbar p-4 space-y-4">
          {/* Create new chat row */}
          <button
            onClick={() => { onNewChat(); onClose(); }}
            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl bg-accent text-[#0A0D12] text-xs font-semibold hover:brightness-105 active:scale-[0.99] transition-all shadow-[0_4px_12px_rgba(0,212,179,0.12)]"
          >
            <span className="text-sm font-bold leading-none">+</span>
            <span>Nuevo chat</span>
          </button>

          {/* Groups list */}
          {grouped.map(([groupName, items]) => (
            <div key={groupName} className="space-y-1.5">
              <h5 className="text-[11px] font-bold tracking-wider text-gray-400 dark:text-white/30 uppercase px-2">{groupName}</h5>
              <div className="space-y-0.5">
                {items.map((conv) => (
                  <button
                    key={conv.id}
                    onClick={() => { onSelectConversation(conv.id); onClose(); }}
                    className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left text-xs font-medium text-gray-700 hover:bg-gray-100/50 dark:text-white/70 dark:hover:bg-white/[0.04] hover:text-gray-900 dark:hover:text-white transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <svg className="w-3.5 h-3.5 shrink-0 text-gray-400 dark:text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                      <span className="truncate">{conv.title}</span>
                    </div>
                    {conv.is_pinned && (
                      <svg viewBox="0 0 24 24" className="h-3 w-3 shrink-0 text-accent/60 rotate-[35deg]" fill="currentColor">
                        <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2z" />
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            </div>
          ))}

          {grouped.length === 0 && (
            <div className="py-8 text-center text-xs text-gray-400 dark:text-white/30">
              No se encontraron conversaciones con "{query}"
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
