import type { Folder } from '../../services/folder-service';
import type { Conversation } from '../../services/chat-service';
import type { SidebarProps } from './types';
import { ChatItem } from './ChatItem';
import { buildChatItemProps } from './chatProps';
import { ChevronIcon } from './ChevronIcon';
import { ShareBadge } from './ShareBadge';

export function FolderRow({
  props,
  folder,
  chats,
  isExpanded,
  isActive,
}: {
  props: SidebarProps;
  folder: Folder;
  chats: Conversation[];
  isExpanded: boolean;
  isActive: boolean;
}) {
  const { isOpen } = props;
  return (
    <div>
      <div
        className={`w-full flex items-center ${isOpen ? 'gap-2.5 px-3' : 'justify-center px-0'} py-2 rounded-lg text-[13px] transition-all duration-200 cursor-pointer group ${folderStateClass(isActive, isExpanded)}`}
        onClick={() => props.onToggleFolder(folder.id)}
        onDoubleClick={() => props.onOpenProject(folder.id)}
        title={folder.name}
      >
        {isOpen && <ChevronIcon className={`h-3 w-3 flex-shrink-0 transition-transform duration-200 opacity-60 group-hover:opacity-100 ${isActive ? 'text-accent opacity-100' : ''} ${isExpanded ? 'rotate-90' : ''}`} />}
        <FolderIcon active={isActive} />
        {isOpen && <FolderTitle folder={folder} chats={chats} props={props} />}
      </div>
      {isExpanded && isOpen && (
        <div className="ml-4 space-y-0.5">
          {chats.length === 0
            ? <p className="px-3 py-1.5 text-[11px] text-gray-400 dark:text-gray-600 italic">Vacia</p>
            : chats.map((conv) => <ChatItem key={conv.id} {...buildChatItemProps(props, conv, true)} />)}
        </div>
      )}
    </div>
  );
}

function folderStateClass(isActive: boolean, isExpanded: boolean): string {
  if (isActive) return 'bg-accent/10 dark:bg-accent/20 text-accent font-semibold shadow-sm';
  if (isExpanded) return 'bg-gray-100/50 dark:bg-white/[0.04] text-gray-800 dark:text-gray-200 font-medium';
  return 'text-gray-600 dark:text-gray-400 hover:bg-gray-100/80 dark:hover:bg-white/[0.04] hover:text-gray-900 dark:hover:text-gray-200';
}

function FolderIcon({ active }: { active: boolean }) {
  return (
    <div className={`flex items-center justify-center w-6 h-6 shrink-0 rounded-[8px] border transition-all duration-200 ${active ? 'bg-accent/20 border-accent/30 text-accent' : 'bg-white dark:bg-white/[0.02] border-gray-200/50 dark:border-white/[0.08] text-gray-400 group-hover:text-accent group-hover:border-accent/20'}`}>
      <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 2.5 : 2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
      </svg>
    </div>
  );
}

function FolderTitle({ folder, chats, props }: { folder: Folder; chats: Conversation[]; props: SidebarProps }) {
  return (
    <>
      <div className="flex flex-1 min-w-0 items-center gap-2">
        <span className="min-w-0 flex-1 text-left truncate">{folder.name}</span>
        {folder.is_shared && <ShareBadge owner={Boolean(folder.can_share)} ownerTitle="Compartida por ti" memberTitle="Compartida contigo" />}
      </div>
      {chats.length > 0 && <span className="text-[10px] bg-gray-200/50 dark:bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity px-1.5 py-0.5 rounded-full text-gray-500 dark:text-gray-400">{chats.length}</span>}
      {folder.can_share && (
        <button onClick={(e) => props.onDeleteFolder(folder.id, e)} className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-gray-300 dark:hover:bg-white/10 transition-all" title="Eliminar carpeta">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-gray-500 hover:text-danger" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      )}
    </>
  );
}
