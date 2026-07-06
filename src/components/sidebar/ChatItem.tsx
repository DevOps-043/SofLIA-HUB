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
    ? 'relative min-h-7 w-full flex items-center px-2.5 py-1 rounded-xl text-[12.5px] transition-all duration-200 group/chat'
    : `relative min-h-9 w-full flex items-center ${sidebarOpen ? 'px-2.5' : 'justify-center px-0'} rounded-2xl text-[13px] transition-all duration-200 group`;
  const activeClass = isActive
    ? 'bg-[#0A2540]/10 text-[#0A2540] font-semibold shadow-[inset_0_0_0_1px_rgba(10,37,64,0.08)] dark:bg-accent/10 dark:text-accent dark:shadow-[inset_0_0_0_1px_rgba(0,212,179,0.12)]'
    : 'text-secondary dark:text-white/50 hover:bg-[#0A2540]/5 hover:text-[#0A2540] dark:hover:bg-white/[0.05] dark:hover:text-white/80';
  const menuLayerClass = props.isMenuOpen ? 'z-40' : 'z-0';

  return (
    <div role="button" tabIndex={0} onClick={(event) => handleItemClick(event, props)} onKeyDown={(e) => handleSelectKey(e, props.onSelect)} className={`${baseClass} ${activeClass} ${menuLayerClass}`} title={conv.title}>
      {!sidebarOpen && <ChatIndicator active={isActive} />}
      {sidebarOpen && (
        <>
          {isRenaming ? <RenameInput compact={compact} value={editingTitle} props={props} /> : <ChatTitle conv={conv} compact={compact} />}
          {!isRenaming && <ChatActions props={props} />}
        </>
      )}
    </div>
  );
}

function ChatIndicator({ active }: { active: boolean }) {
  return <div className={`h-2.5 w-2.5 shrink-0 rounded-full transition-all duration-200 ${active ? 'bg-accent shadow-[0_0_10px_rgba(0,212,179,0.45)]' : 'bg-gray-300 group-hover:bg-[#0A2540]/40 dark:bg-white/[0.16] dark:group-hover:bg-accent/60'}`} />;
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
