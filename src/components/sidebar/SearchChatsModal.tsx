import { useState, useMemo, useEffect, useRef } from 'react';
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
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return conversations;
    return conversations.filter((c) => c.title.toLowerCase().includes(trimmed));
  }, [conversations, query]);

  const grouped = useMemo(() => {
    const groups: Record<string, Conversation[]> = {
      Hoy: [],
      Ayer: [],
      'Hace 7 días': [],
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
        groups['Hace 7 días'].push(conv);
      } else {
        groups.Anteriores.push(conv);
      }
    }

    return Object.entries(groups).filter(([_, items]) => items.length > 0);
  }, [filtered]);

  const flatItems = useMemo(() => {
    return grouped.flatMap(([_, items]) => items);
  }, [grouped]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
    }
  }, [isOpen]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (flatItems.length > 0 ? (prev + 1) % flatItems.length : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (flatItems.length > 0 ? (prev - 1 + flatItems.length) % flatItems.length : 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (flatItems[selectedIndex]) {
        onSelectConversation(flatItems[selectedIndex].id);
        onClose();
      }
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!isOpen) return null;

  let globalItemIndex = 0;

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-md z-[100] flex items-start justify-center pt-[12vh] px-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-white dark:bg-[#0c1017] border border-gray-200/80 dark:border-white/10 rounded-2xl shadow-[0_1.5rem_4rem_rgba(0,0,0,0.5)] overflow-hidden flex flex-col max-h-[70vh] animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
        style={{ fontFamily: 'var(--font-system-ui)' }}
      >
        {/* Header Search Input */}
        <div className="relative flex items-center border-b border-gray-200/60 dark:border-white/10 px-4 py-3.5 shrink-0">
          <svg className="w-4 h-4 text-gray-400 dark:text-white/40 shrink-0 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <circle cx="11" cy="11" r="8" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35" />
          </svg>

          <input
            ref={inputRef}
            type="text"
            placeholder="Buscar chats por título..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 bg-transparent text-sm font-medium text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-white/35 focus:outline-none py-0.5 leading-normal"
          />

          {query ? (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="p-1 text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors rounded-lg"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          ) : (
            <kbd
              className="px-2 py-0.5 text-[10px] font-mono font-semibold text-gray-400 dark:text-white/40 bg-gray-100 dark:bg-white/10 rounded-md border border-gray-200 dark:border-white/10 shrink-0"
              style={{ fontFamily: 'var(--font-system-label)' }}
            >
              ESC
            </kbd>
          )}
        </div>

        {/* Action Row & Search List */}
        <div className="flex-1 overflow-y-auto sidebar-scrollbar p-2.5 space-y-3">
          {/* Subtle New Chat Option */}
          <button
            type="button"
            onClick={() => {
              onNewChat();
              onClose();
            }}
            className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-accent hover:bg-accent/10 border border-accent/20 bg-accent/5 transition-all duration-150 group"
          >
            <div className="flex h-5 w-5 items-center justify-center rounded-lg bg-accent text-on-accent font-bold shrink-0 group-hover:scale-105 transition-transform leading-none">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            </div>
            <span className="leading-none">Crear nuevo chat</span>
          </button>

          {/* Grouped Chats */}
          {grouped.map(([groupName, items]) => (
            <div key={groupName} className="space-y-1">
              <div className="px-3.5 pt-2 pb-1 flex items-center gap-2">
                <span
                  className="text-[9.5px] font-bold tracking-[0.16em] uppercase text-gray-400 dark:text-white/40"
                  style={{ fontFamily: 'var(--font-system-label)' }}
                >
                  {groupName}
                </span>
                <span className="h-px flex-1 bg-gray-200/60 dark:bg-white/[0.06]" aria-hidden="true" />
              </div>

              <div className="space-y-0.5">
                {items.map((conv) => {
                  const currentIndex = globalItemIndex++;
                  const isSelected = currentIndex === selectedIndex;

                  return (
                    <button
                      key={conv.id}
                      type="button"
                      onClick={() => {
                        onSelectConversation(conv.id);
                        onClose();
                      }}
                      onMouseEnter={() => setSelectedIndex(currentIndex)}
                      className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-left text-xs font-medium transition-all duration-150 ${
                        isSelected
                          ? 'bg-accent/15 text-accent font-semibold'
                          : 'text-gray-700 dark:text-white/80 hover:bg-gray-100/80 dark:hover:bg-white/[0.05] hover:text-gray-900 dark:hover:text-white'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <svg
                          className={`w-4 h-4 shrink-0 transition-colors ${
                            isSelected ? 'text-accent' : 'text-gray-400 dark:text-white/40'
                          }`}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={1.8}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a.75.75 0 01-1.004-.766c.098-1.042.44-2.02 1.004-2.85A8.172 8.172 0 013 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z"
                          />
                        </svg>
                        <span className="truncate leading-normal">{conv.title}</span>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 ml-2">
                        {conv.is_pinned && (
                          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-accent shrink-0" fill="currentColor">
                            <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2z" />
                          </svg>
                        )}
                        {isSelected && (
                          <span
                            className="text-[10.5px] font-semibold text-accent/90 opacity-90 shrink-0"
                            style={{ fontFamily: 'var(--font-system-label)' }}
                          >
                            ↵ Enter
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {grouped.length === 0 && (
            <div className="py-8 text-center text-xs text-gray-400 dark:text-white/40">
              No se encontraron conversaciones para &ldquo;{query}&rdquo;
            </div>
          )}
        </div>

        {/* Footer Keyboard Hints */}
        <div
          className="border-t border-gray-200/60 dark:border-white/10 px-4 py-2.5 bg-gray-50/50 dark:bg-white/[0.02] flex items-center justify-between text-[11px] text-gray-400 dark:text-white/40 shrink-0"
          style={{ fontFamily: 'var(--font-system-label)' }}
        >
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5">
              <kbd className="px-1.5 py-0.5 bg-gray-200/60 dark:bg-white/10 rounded-md text-[10px] font-mono font-semibold border border-gray-300/40 dark:border-white/10">↑↓</kbd> Navegar
            </span>
            <span className="flex items-center gap-1.5">
              <kbd className="px-1.5 py-0.5 bg-gray-200/60 dark:bg-white/10 rounded-md text-[10px] font-mono font-semibold border border-gray-300/40 dark:border-white/10">↵</kbd> Seleccionar
            </span>
          </div>
          <span className="flex items-center gap-1.5">
            <kbd className="px-1.5 py-0.5 bg-gray-200/60 dark:bg-white/10 rounded-md text-[10px] font-mono font-semibold border border-gray-300/40 dark:border-white/10">Esc</kbd> Cerrar
          </span>
        </div>
      </div>
    </div>
  );
}
