import type { Folder } from '../../services/folder-service';
import type { Conversation } from '../../services/chat-service';
import type { SidebarProps } from './types';
import { ChatItem } from './ChatItem';
import { buildChatItemProps } from './chatProps';
import { ChevronIcon } from './ChevronIcon';
import { EditIcon } from './ChatIcons';
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
  const isRenaming = props.renamingFolderId === folder.id;
  return (
    <div className="mb-0.5">
      <div
        className={`min-h-9 w-full flex items-center ${isOpen ? 'gap-2 px-2' : 'justify-center px-0'} rounded-2xl text-[13px] transition-all duration-200 cursor-pointer group ${folderStateClass(isActive, isExpanded)}`}
        onClick={() => { if (!isRenaming) props.onToggleFolder(folder.id); }}
        onDoubleClick={() => { if (!isRenaming) props.onOpenProject(folder.id); }}
        title={folder.name}
      >
        {isOpen && <ChevronIcon className={`h-3 w-3 flex-shrink-0 transition-transform duration-200 opacity-50 group-hover:opacity-100 ${isActive ? 'text-accent opacity-100' : ''} ${isExpanded ? 'rotate-90' : ''}`} />}
        <FolderIcon active={isActive} />
        {isOpen && (isRenaming
          ? <FolderRenameInput props={props} />
          : <FolderTitle folder={folder} chats={chats} props={props} />)}
      </div>
      {isExpanded && isOpen && (
        <div className="ml-4 mt-1 space-y-0.5 border-l border-gray-200/60 pl-2 dark:border-white/[0.06]">
          {chats.length === 0
            ? <p className="px-2 py-1.5 text-[11px] italic text-secondary/70 dark:text-white/30">Vacia</p>
            : chats.map((conv) => <ChatItem key={conv.id} {...buildChatItemProps(props, conv, true)} />)}
        </div>
      )}
    </div>
  );
}

function folderStateClass(isActive: boolean, isExpanded: boolean): string {
  if (isActive) return 'bg-[#0A2540]/10 text-[#0A2540] font-semibold shadow-[inset_0_0_0_1px_rgba(10,37,64,0.08)] dark:bg-accent/10 dark:text-accent dark:shadow-[inset_0_0_0_1px_rgba(0,212,179,0.12)]';
  if (isExpanded) return 'bg-gray-100/80 text-[#0A2540] font-medium dark:bg-white/[0.05] dark:text-white';
  return 'text-secondary dark:text-white/50 hover:bg-[#0A2540]/5 hover:text-[#0A2540] dark:hover:bg-white/[0.05] dark:hover:text-white/80';
}

function FolderIcon({ active }: { active: boolean }) {
  return (
    <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-2xl transition-all duration-200 ${active ? 'bg-[#0A2540] text-white dark:bg-accent dark:text-on-accent' : 'bg-white text-secondary shadow-[inset_0_0_0_1px_rgba(10,37,64,0.08)] group-hover:text-[#0A2540] dark:bg-white/[0.04] dark:text-white/50 dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)] dark:group-hover:text-accent'}`}>
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
      {/* Renombrar y eliminar solo las carpetas propias: en una recibida el
          usuario no es dueño y la accion la rechazaria el servicio igual. */}
      {folder.can_share && (
        <>
          <button
            onClick={(event) => { event.stopPropagation(); props.onStartRenameFolder(folder.id); }}
            className="rounded-lg p-1 text-gray-500 opacity-0 transition-all hover:bg-[#0A2540]/10 hover:text-[#0A2540] group-hover:opacity-100 dark:hover:bg-white/10 dark:hover:text-accent"
            title="Renombrar carpeta"
          >
            <EditIcon />
          </button>
          <button onClick={(e) => props.onDeleteFolder(folder.id, e)} className="rounded-lg p-1 opacity-0 transition-all hover:bg-danger/10 group-hover:opacity-100" title="Eliminar carpeta">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-gray-500 hover:text-danger" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </>
      )}
    </>
  );
}

function FolderRenameInput({ props }: { props: SidebarProps }) {
  return (
    <input
      autoFocus
      type="text"
      className="min-w-0 flex-1 rounded-xl border border-accent bg-white px-2 py-1 text-[13px] text-gray-900 outline-none dark:bg-[#111820] dark:text-white"
      value={props.editingFolderName}
      onChange={(event) => props.onSetEditingFolderName(event.target.value)}
      onBlur={props.onFinishRenameFolder}
      onClick={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === 'Enter') props.onFinishRenameFolder();
        else if (event.key === 'Escape') props.onCancelRenameFolder();
      }}
    />
  );
}
