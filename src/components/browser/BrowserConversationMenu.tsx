import { useEffect, useMemo, useRef, useState } from 'react';

const MAX_VISIBLE_CONVERSATIONS = 40;

export interface BrowserConversationItem {
  id: string;
  title: string;
  updated_at: string;
}

interface BrowserConversationMenuProps {
  conversations: BrowserConversationItem[];
  currentConversationId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNewChat: () => Promise<void>;
  onSelectConversation: (conversationId: string) => Promise<void>;
}

export function BrowserConversationMenu(props: BrowserConversationMenuProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const wasOpenRef = useRef(false);
  const { open, onOpenChange } = props;
  const [query, setQuery] = useState('');
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const visibleConversations = useMemo(() => {
    const normalizedQuery = normalizeSearchText(query);
    return [...props.conversations]
      .sort((left, right) => toTimestamp(right.updated_at) - toTimestamp(left.updated_at))
      .filter((conversation) => !normalizedQuery || normalizeSearchText(conversation.title).includes(normalizedQuery))
      .slice(0, MAX_VISIBLE_CONVERSATIONS);
  }, [props.conversations, query]);

  useEffect(() => {
    if (!open) {
      setQuery('');
      setActionError(null);
      if (wasOpenRef.current) triggerRef.current?.focus();
      wasOpenRef.current = false;
      return undefined;
    }

    wasOpenRef.current = true;
    const focusTimer = window.setTimeout(() => searchRef.current?.focus(), 0);
    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) onOpenChange(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      onOpenChange(false);
    };
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onOpenChange]);

  const runAction = async (actionId: string, action: () => Promise<void>) => {
    if (pendingAction) return;
    setPendingAction(actionId);
    setActionError(null);
    try {
      await action();
      props.onOpenChange(false);
    } catch (error) {
      console.warn('[BrowserConversationMenu] no se pudo cambiar la conversación:', error);
      setActionError('No pude abrir ese chat. Intenta de nuevo.');
    } finally {
      setPendingAction(null);
    }
  };

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        ref={triggerRef}
        type="button"
        aria-label="Abrir conversaciones"
        aria-haspopup="dialog"
        aria-expanded={props.open}
        onClick={() => props.onOpenChange(!props.open)}
        className={`grid h-7 w-7 place-items-center rounded-lg transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
          props.open
            ? 'bg-accent/15 text-accent shadow-xs'
            : 'text-secondary hover:bg-accent/10 hover:text-accent'
        }`}
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          <path d="M8 9h8" />
          <path d="M8 13h5" />
        </svg>
      </button>

      {props.open && (
        <div
          role="dialog"
          aria-label="Conversaciones de SofLIA"
          className="absolute right-0 top-full z-50 mt-2 flex max-h-[28rem] w-80 max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-gray-200/90 dark:border-white/12 bg-white/95 dark:bg-[#11161d]/95 p-2.5 shadow-[0_1.75rem_4.5rem_rgba(2,12,23,0.36)] backdrop-blur-2xl animate-in fade-in slide-in-from-top-2 duration-150"
          style={{ fontFamily: 'var(--font-system-ui)' }}
        >
          {/* Luz ambiental sutil */}
          <div className="absolute right-0 top-0 h-32 w-32 rounded-full bg-accent/8 blur-2xl pointer-events-none" aria-hidden="true" />

          <div className="flex items-center justify-between gap-3 px-1.5 pb-2 pt-0.5 relative z-10">
            <div className="min-w-0">
              <p className="truncate text-[13px] font-bold text-gray-900 dark:text-white">Conversaciones</p>
              <p className="text-[10px] text-gray-500 dark:text-white/50">Continúa donde lo dejaste</p>
            </div>
            <button
              type="button"
              disabled={Boolean(pendingAction)}
              onClick={() => void runAction('new', props.onNewChat)}
              className="inline-flex h-7.5 items-center gap-1.5 rounded-xl bg-accent px-3 text-[11px] font-bold text-on-accent shadow-xs transition-all hover:scale-[1.02] hover:shadow-md active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 disabled:cursor-wait disabled:opacity-60"
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
              <span>Nuevo chat</span>
            </button>
          </div>

          <label className="relative block px-0.5 pb-2 pt-0.5 relative z-10">
            <span className="sr-only">Buscar chats</span>
            <svg className="pointer-events-none absolute left-3 top-2.5 h-3.5 w-3.5 text-gray-400 dark:text-white/40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
            <input
              ref={searchRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar chats..."
              className="h-8 w-full rounded-xl border border-gray-200/80 dark:border-white/10 bg-gray-100/60 dark:bg-white/[0.05] pl-8.5 pr-3 text-[11px] text-gray-900 dark:text-white outline-none transition placeholder:text-gray-400 dark:placeholder:text-white/40 focus:border-accent/60 focus:bg-white dark:focus:bg-[#161c24] focus:ring-2 focus:ring-accent/15"
            />
          </label>

          <div className="no-scrollbar min-h-0 overflow-y-auto px-0.5 pb-0.5 relative z-10">
            {visibleConversations.length > 0 ? (
              <div className="space-y-1">
                {visibleConversations.map((conversation) => {
                  const active = conversation.id === props.currentConversationId;
                  const pending = pendingAction === conversation.id;
                  return (
                    <button
                      key={conversation.id}
                      type="button"
                      disabled={Boolean(pendingAction)}
                      onClick={() => {
                        if (active) {
                          props.onOpenChange(false);
                          return;
                        }
                        void runAction(conversation.id, () => props.onSelectConversation(conversation.id));
                      }}
                      className={`flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/20 disabled:cursor-wait disabled:opacity-60 border ${
                        active
                          ? 'bg-accent/10 dark:bg-accent/15 border-accent/25 text-accent shadow-xs'
                          : 'border-transparent text-gray-800 dark:text-white/90 hover:bg-gray-100/80 dark:hover:bg-white/[0.05] hover:border-gray-200/50 dark:hover:border-white/5'
                      }`}
                    >
                      <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg border transition-all ${active ? 'border-accent/30 bg-accent/15 text-accent' : 'border-gray-200/70 dark:border-white/10 bg-gray-100/70 dark:bg-white/[0.06] text-gray-500 dark:text-white/45'}`}>
                        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                        </svg>
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className={`block truncate text-[11.5px] ${active ? 'font-bold text-accent' : 'font-semibold text-gray-900 dark:text-white'}`}>{conversation.title || 'Chat sin título'}</span>
                        <span className="block truncate text-[9.5px] text-gray-400 dark:text-white/45 mt-0.5">{formatUpdatedAt(conversation.updated_at)}</span>
                      </span>
                      {active && (
                        <svg className="h-3.5 w-3.5 shrink-0 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-label="Chat activo"><polyline points="20 6 9 17 4 12" /></svg>
                      )}
                      {pending && <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-r-transparent" aria-label="Abriendo chat" />}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-gray-200 dark:border-white/10 px-3 py-6 text-center">
                <p className="text-[11px] font-semibold text-gray-800 dark:text-white">Sin coincidencias</p>
                <p className="mt-1 text-[10px] text-gray-400 dark:text-white/40">Prueba con otro título.</p>
              </div>
            )}
          </div>

          {actionError && (
            <p role="alert" className="mx-1 mt-1.5 rounded-xl bg-danger/10 border border-danger/20 px-2.5 py-2 text-[10px] text-danger font-medium">
              {actionError}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function normalizeSearchText(value: string): string {
  return value.trim().toLocaleLowerCase('es').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function toTimestamp(value: string): number {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function formatUpdatedAt(value: string): string {
  const timestamp = toTimestamp(value);
  if (!timestamp) return 'Sin fecha';
  return new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short' }).format(timestamp);
}
