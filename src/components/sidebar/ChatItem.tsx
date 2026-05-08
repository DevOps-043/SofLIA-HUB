import type { KeyboardEvent, MouseEvent } from 'react';
import type { Conversation } from '../../services/chat-service';
import { ChatActions } from './ChatActions';
import { ChatBubbleIcon } from './ChatIcons';
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
};

export function ChatItem(props: ChatItemProps) {
  const { conv, isActive, isRenaming, editingTitle, compact, sidebarOpen } = props;
  const baseClass = compact
    ? 'w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[12.5px] transition-all duration-200 group/chat'
    : `w-full flex items-center ${sidebarOpen ? 'gap-2.5 px-3' : 'justify-center px-0'} py-2 rounded-lg text-[13px] transition-all duration-200 group`;
  const activeClass = isActive
    ? 'bg-accent/10 dark:bg-accent/15 text-accent font-medium shadow-sm'
    : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100/80 dark:hover:bg-white/[0.04] hover:text-gray-900 dark:hover:text-gray-200';

  return (
    <div role="button" tabIndex={0} onClick={props.onSelect} onKeyDown={(e) => handleSelectKey(e, props.onSelect)} className={`${baseClass} ${activeClass}`} title={conv.title}>
      <ChatIndicator compact={compact} active={isActive} />
      {sidebarOpen && (
        <>
          {isRenaming ? <RenameInput compact={compact} value={editingTitle} props={props} /> : <ChatTitle conv={conv} compact={compact} />}
          <ChatActions props={props} />
        </>
      )}
    </div>
  );
}

function ChatIndicator({ compact, active }: { compact?: boolean; active: boolean }) {
  if (compact) {
    return <div className={`flex items-center justify-center w-2 h-2 shrink-0 rounded-full transition-all duration-200 ${active ? 'bg-accent shadow-[0_0_6px_var(--tw-colors-accent)]' : 'bg-gray-300 dark:bg-white/[0.15] group-hover/chat:bg-gray-400 dark:group-hover/chat:bg-white/30'}`} />;
  }
  return (
    <div className={`flex items-center justify-center w-6 h-6 shrink-0 rounded-[8px] border transition-all duration-200 ${active ? 'bg-accent/20 border-accent/30 text-accent' : 'bg-white dark:bg-white/[0.02] border-gray-200/50 dark:border-white/[0.08] text-gray-400 group-hover:text-accent group-hover:border-accent/20'}`}>
      <ChatBubbleIcon active={active} />
    </div>
  );
}

function ChatTitle({ conv, compact }: { conv: Conversation; compact?: boolean }) {
  return (
    <div className="flex flex-1 min-w-0 items-center gap-2">
      <span className={`min-w-0 flex-1 text-left truncate${compact ? '' : ' text-[13px]'}`}>{conv.title}</span>
      {conv.is_shared && <ShareBadge owner={Boolean(conv.can_share)} ownerTitle="Compartido por ti" memberTitle="Compartido contigo" />}
    </div>
  );
}

function RenameInput({ compact, value, props }: { compact?: boolean; value: string; props: ChatItemProps }) {
  return (
    <input
      autoFocus
      type="text"
      className={`flex-1 min-w-0 bg-white dark:bg-[#1E1E1E] border border-accent rounded px-2 py-0.5 text-[${compact ? '12' : '13'}px] text-gray-900 dark:text-white outline-none`}
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
