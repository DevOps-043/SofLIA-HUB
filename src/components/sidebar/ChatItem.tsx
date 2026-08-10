import { useEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react';
import type { Conversation } from '../../services/chat-service';
import { ChatActions } from './ChatActions';
import { ShareBadge } from './ShareBadge';

export type ChatItemProps = {
  conv: Conversation;
  isActive: boolean;
  isRenaming: boolean;
  editingTitle: string;
  isMenuOpen: boolean;
  compact?: boolean;
  sidebarOpen: boolean;
  onSelect: () => void;
  onStartRename: () => void;
  onEditTitle: (val: string) => void;
  onFinishRename: () => void;
  onCancelRename: () => void;
  onToggleMenu: () => void;
  onMove: () => void;
  onDelete: (e: MouseEvent) => void;
  canRename: boolean;
  canMove: boolean;
  canDelete: boolean;
  isPinned: boolean;
  onTogglePin: () => void;
};

export function ChatItem(props: ChatItemProps) {
  const { conv, isActive, isRenaming, editingTitle, compact, sidebarOpen } = props;
  const baseClass = compact
    ? 'relative min-h-7 w-full flex items-center px-2.5 py-1 rounded-xl text-[12.5px] transition-all duration-150 group/chat'
    : `relative min-h-[2.15rem] w-full flex items-center ${sidebarOpen ? 'px-2.5 py-1.5' : 'justify-center px-0 py-1'} rounded-xl text-[13px] transition-all duration-150 group`;
  const activeClass = isActive
    ? 'bg-accent/10 text-accent font-semibold dark:bg-accent/15 dark:text-accent'
    : 'text-gray-600 dark:text-white/60 hover:bg-gray-100/70 hover:text-gray-900 dark:hover:bg-white/[0.05] dark:hover:text-white/90';
  const menuLayerClass = props.isMenuOpen ? 'z-40' : 'z-0';

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={(event) => handleItemClick(event, props)}
      onKeyDown={(e) => handleSelectKey(e, props.onSelect)}
      className={`${baseClass} ${activeClass} ${menuLayerClass}`}
      style={{ fontFamily: 'var(--font-system-ui)' }}
      title={conv.title}
    >
      {!sidebarOpen && <ChatIndicator active={isActive} title={conv.title} isPinned={conv.is_pinned} />}
      {sidebarOpen && (
        <>
          {isRenaming ? <RenameInput compact={compact} value={editingTitle} props={props} /> : <ChatTitle conv={conv} compact={compact} />}
          {!isRenaming && <ChatActions props={props} />}
        </>
      )}
    </div>
  );
}

function ChatIndicator({ active, title, isPinned }: { active: boolean; title: string; isPinned?: boolean }) {
  return (
    <div
      className={`h-9.5 w-9.5 shrink-0 rounded-xl flex items-center justify-center transition-all duration-150 ${
        active
          ? 'text-accent dark:text-accent bg-accent/15 font-semibold'
          : 'text-gray-400 dark:text-white/55 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100/80 dark:hover:bg-white/[0.08]'
      }`}
      title={title}
    >
      {isPinned ? (
        <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V3h1.5V1.5h-12V3h1.5v7.5L5.25 12v1.5h5.25v7.5h1.5v-7.5h5.25V12L16.5 10.5z" />
        </svg>
      ) : (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a.75.75 0 01-1.004-.766c.098-1.042.44-2.02 1.004-2.85A8.172 8.172 0 013 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
        </svg>
      )}
    </div>
  );
}

function ChatTitle({ conv, compact }: { conv: Conversation; compact?: boolean }) {
  const { displayTitle, isTyping } = useTypewriterTitle(conv.title);

  return (
    <div className="flex flex-1 min-w-0 items-center gap-2 pr-5">
      <span className={`min-w-0 flex-1 text-left truncate${compact ? '' : ' text-[13px]'}`} aria-label={conv.title}>
        {displayTitle}
        {isTyping && <span className="ml-0.5 inline-block h-3.5 w-px translate-y-0.5 animate-pulse bg-accent" />}
      </span>
      {conv.is_pinned && (
        <svg viewBox="0 0 24 24" className="h-3 w-3 shrink-0 text-accent/70 rotate-[35deg]" fill="currentColor">
          <title>Fijado</title>
          <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2z" />
        </svg>
      )}
      {conv.is_shared && <ShareBadge owner={Boolean(conv.can_share)} ownerTitle="Compartido por ti" memberTitle="Compartido contigo" />}
    </div>
  );
}

function useTypewriterTitle(title: string): { displayTitle: string; isTyping: boolean } {
  const [displayTitle, setDisplayTitle] = useState(title);
  const [isTyping, setIsTyping] = useState(false);
  const hasMountedRef = useRef(false);
  const previousTitleRef = useRef(title);

  useEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      previousTitleRef.current = title;
      setDisplayTitle(title);
      return;
    }
    if (previousTitleRef.current === title) return;

    previousTitleRef.current = title;
    setDisplayTitle('');
    setIsTyping(true);

    let index = 0;
    const interval = window.setInterval(() => {
      index += 1;
      setDisplayTitle(title.slice(0, index));
      if (index >= title.length) {
        window.clearInterval(interval);
        setIsTyping(false);
      }
    }, 28);

    return () => window.clearInterval(interval);
  }, [title]);

  return { displayTitle: displayTitle || '\u00A0', isTyping };
}

function RenameInput({ compact, value, props }: { compact?: boolean; value: string; props: ChatItemProps }) {
  return (
    <input
      autoFocus
      type="text"
      className={`min-w-0 flex-1 rounded-xl border border-accent bg-white px-2 py-1 text-gray-900 outline-none dark:bg-[#111820] dark:text-white ${compact ? 'text-[12px]' : 'text-[13px]'}`}
      value={value}
      onChange={(e) => props.onEditTitle(e.target.value)}
      onBlur={props.onFinishRename}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === 'Enter') props.onFinishRename();
        else if (e.key === 'Escape') props.onCancelRename();
      }}
    />
  );
}

function handleSelectKey(event: KeyboardEvent, onSelect: () => void): void {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  event.preventDefault();
  onSelect();
}

function handleItemClick(event: MouseEvent, props: ChatItemProps): void {
  if (props.isMenuOpen) {
    event.stopPropagation();
    return;
  }
  props.onSelect();
}
