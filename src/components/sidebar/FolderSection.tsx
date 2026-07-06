import type { SidebarProps } from './types';
import { FolderRow } from './FolderRow';
import { splitChatsByFolder } from './chatProps';
import { SidebarSectionLabel } from './SidebarSectionLabel';

export function FolderSection({ props }: { props: SidebarProps }) {
  const { folderChats } = splitChatsByFolder(props);
  if (props.folders.length === 0) return null;

  return (
    <>
      {props.isOpen && <SidebarSectionLabel label="Carpetas" />}
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
