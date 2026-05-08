import type { SidebarProps } from './types';
import { FolderRow } from './FolderRow';
import { splitChatsByFolder } from './chatProps';

export function FolderSection({ props }: { props: SidebarProps }) {
  const { folderChats } = splitChatsByFolder(props);
  if (props.folders.length === 0) return null;

  return (
    <>
      {props.isOpen && (
        <div className="pt-5 pb-2 px-3">
          <span className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-[0.15em] font-semibold">Carpetas</span>
        </div>
      )}
      {props.folders.map((folder) => (
        <FolderRow
          key={folder.id}
          props={props}
          folder={folder}
          chats={folderChats(folder.id)}
          isExpanded={props.expandedFolders.has(folder.id)}
          isActive={props.activeView === 'project' && props.currentFolderId === folder.id}
        />
      ))}
    </>
  );
}
