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
        className={`grid h-7 w-7 place-items-center rounded-[9px] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${props.open ? 'bg-accent/10 text-accent' : 'text-secondary hover:bg-accent/10 hover:text-accent'}`}
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M7 17.5 3.5 20v-4.5A7.5 7.5 0 0 1 2 11c0-4.4 4.25-8 9.5-8S21 6.6 21 11s-4.25 8-9.5 8a11.4 11.4 0 0 1-4.5-.9" />
          <path d="M16.5 7.5v6M13.5 10.5h6" />
        </svg>
      </button>

      {props.open && (
        <div
          role="dialog"
          aria-label="Conversaciones de SofLIA"
          className="absolute right-0 top-full z-50 mt-2 flex max-h-[28rem] w-80 max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-border bg-card/98 p-2 shadow-[0_1.5rem_4rem_rgba(2,12,23,0.24)] backdrop-blur-xl"
          style={{ fontFamily: 'var(--font-system-ui)' }}
        >
          <div className="flex items-center justify-between gap-3 px-2 pb-2 pt-1">
            <div className="min-w-0">
              <p className="truncate text-[13px] font-semibold text-primary dark:text-white">Conversaciones</p>
              <p className="text-[10px] text-secondary">Continúa donde lo dejaste</p>
            </div>
            <button
              type="button"
              disabled={Boolean(pendingAction)}
              onClick={() => void runAction('new', props.onNewChat)}
              className="inline-flex h-8 items-center gap-1.5 rounded-xl bg-accent px-2.5 text-[11px] font-semibold text-on-accent shadow-sm transition hover:-translate-y-px hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 disabled:cursor-wait disabled:opacity-60"
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
              Nuevo chat
            </button>
          </div>

          <label className="relative block px-1 pb-2">
            <span className="sr-only">Buscar chats</span>
            <svg className="pointer-events-none absolute left-3.5 top-2 h-3.5 w-3.5 text-secondary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
            <input
              ref={searchRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar chats..."
              className="h-8 w-full rounded-xl border border-border bg-background/70 pl-8 pr-3 text-[11px] text-primary outline-none transition placeholder:text-secondary/70 focus:border-accent/50 focus:ring-2 focus:ring-accent/10 dark:bg-background-dark/70 dark:text-white"
            />
          </label>

          <div className="no-scrollbar min-h-0 overflow-y-auto px-1 pb-1">
            {visibleConversations.length > 0 ? (
              <div className="space-y-0.5">
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
                      className={`flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/20 disabled:cursor-wait disabled:opacity-60 ${active ? 'bg-accent/10 text-accent' : 'text-primary hover:bg-primary/[0.045] dark:text-white dark:hover:bg-white/[0.05]'}`}
                    >
                      <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-[10px] border ${active ? 'border-accent/25 bg-accent/10' : 'border-border bg-background/60 dark:bg-background-dark/60'}`}>
                        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M8 18 3 21v-5a8 8 0 1 1 5 2Z" /></svg>
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[11px] font-semibold">{conversation.title || 'Chat sin título'}</span>
                        <span className="block truncate text-[9px] text-secondary">{formatUpdatedAt(conversation.updated_at)}</span>
                      </span>
                      {active && (
                        <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-label="Chat activo"><path d="m5 12 4 4L19 6" /></svg>
                      )}
                      {pending && <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-r-transparent" aria-label="Abriendo chat" />}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-border px-3 py-6 text-center">
                <p className="text-[11px] font-semibold text-primary dark:text-white">Sin coincidencias</p>
                <p className="mt-1 text-[10px] text-secondary">Prueba con otro título.</p>
              </div>
            )}
          </div>

          {actionError && (
            <p role="alert" className="mx-1 mt-1 rounded-xl bg-danger/10 px-2.5 py-2 text-[10px] text-danger">
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
