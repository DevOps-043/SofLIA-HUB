import type { Folder } from '../../services/folder-service';
import type { Conversation } from '../../services/chat-service';
import type { SidebarProps } from './types';
import { ChatItem } from './ChatItem';
import { buildChatItemProps } from './chatProps';
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

  if (!isOpen) return null;

  return (
    <div className="mb-0.5" style={{ fontFamily: 'var(--font-system-ui)' }}>
      <div
        className={`h-8.5 w-full flex items-center gap-2 px-2 rounded-xl text-[13px] transition-all duration-150 cursor-pointer group ${folderStateClass(isActive, isExpanded)}`}
        onClick={() => { if (!isRenaming) props.onToggleFolder(folder.id); }}
        onDoubleClick={() => { if (!isRenaming) props.onOpenProject(folder.id); }}
        title={folder.name}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className={`h-3.5 w-3.5 shrink-0 transition-transform duration-200 text-gray-400 dark:text-white/40 group-hover:text-gray-700 dark:group-hover:text-white ${isActive ? 'text-accent opacity-100' : ''} ${isExpanded ? 'rotate-90' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>

        <FolderIcon active={isActive} isExpanded={isExpanded} />

        {isRenaming ? (
          <FolderRenameInput props={props} />
        ) : (
          <FolderTitle folder={folder} chats={chats} props={props} />
        )}
      </div>

      {isExpanded && (
        <div className="ml-4 mt-1 space-y-0.5 border-l border-gray-200/60 pl-2 dark:border-white/10">
          {chats.length === 0 ? (
            <p className="px-2 py-1 text-[11px] italic text-gray-400 dark:text-white/35">Vacía</p>
          ) : (
            chats.map((conv) => <ChatItem key={conv.id} {...buildChatItemProps(props, conv, true)} />)
          )}
        </div>
      )}
    </div>
  );
}

function folderStateClass(isActive: boolean, isExpanded: boolean): string {
  if (isActive) return 'bg-accent/12 dark:bg-accent/15 text-accent font-semibold shadow-2xs';
  if (isExpanded) return 'bg-gray-100/70 dark:bg-white/[0.05] text-gray-900 dark:text-white font-medium';
  return 'text-gray-600 dark:text-white/60 hover:bg-gray-100/70 dark:hover:bg-white/[0.05] hover:text-gray-900 dark:hover:text-white';
}

function FolderIcon({ active, isExpanded }: { active: boolean; isExpanded: boolean }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className={`h-4 w-4 shrink-0 transition-colors ${
        active
          ? 'text-accent'
          : isExpanded
          ? 'text-gray-700 dark:text-white/90'
          : 'text-gray-400 dark:text-white/45 group-hover:text-gray-700 dark:group-hover:text-white'
      }`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.8}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 9.75A1.5 1.5 0 015.25 8.25h4.125c.398 0 .78.158 1.06.44l1.125 1.125c.28.282.662.44 1.06.44H18.75a1.5 1.5 0 011.5 1.5v6.75a1.5 1.5 0 01-1.5 1.5H5.25a1.5 1.5 0 01-1.5-1.5V9.75z" />
    </svg>
  );
}

function FolderTitle({ folder, chats, props }: { folder: Folder; chats: Conversation[]; props: SidebarProps }) {
  return (
    <>
      <div className="flex flex-1 min-w-0 items-center gap-1.5">
        <span className="min-w-0 flex-1 text-left truncate">{folder.name}</span>
        {folder.is_shared && <ShareBadge owner={Boolean(folder.can_share)} ownerTitle="Compartida por ti" memberTitle="Compartida contigo" />}
      </div>

      {chats.length > 0 && (
        <span
          className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-gray-200/60 dark:bg-white/10 text-gray-500 dark:text-white/40 opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ fontFamily: 'var(--font-system-label)' }}
        >
          {chats.length}
        </span>
      )}

      {folder.can_share && (
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            type="button"
            onClick={(event) => { event.stopPropagation(); props.onStartRenameFolder(folder.id); }}
            className="flex h-6 w-6 items-center justify-center rounded-md text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200/60 dark:hover:bg-white/10 transition-all"
            title="Renombrar carpeta"
          >
            <EditIcon />
          </button>
          <button
            type="button"
            onClick={(e) => props.onDeleteFolder(folder.id, e)}
            className="flex h-6 w-6 items-center justify-center rounded-md text-gray-400 hover:text-danger hover:bg-danger/10 transition-all"
            title="Eliminar carpeta"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
            </svg>
          </button>
        </div>
      )}
    </>
  );
}

function FolderRenameInput({ props }: { props: SidebarProps }) {
  return (
    <input
      autoFocus
      type="text"
      className="min-w-0 flex-1 rounded-lg border border-accent bg-white px-2 py-0.5 text-[13px] text-gray-900 outline-none dark:bg-[#111820] dark:text-white"
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
