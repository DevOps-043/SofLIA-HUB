import { ChatItem } from './ChatItem';
import { buildChatItemProps, splitChatsByFolder } from './chatProps';
import { SidebarSectionLabel } from './SidebarSectionLabel';
import type { SidebarProps } from './types';

export function PinnedChats({ props }: { props: SidebarProps }) {
  const { pinnedChats } = splitChatsByFolder(props);

  if (pinnedChats.length === 0) return null;

  return (
    <div className="mb-4">
      {props.isOpen && (
        <SidebarSectionLabel label="Anclado" />
      )}
      {pinnedChats.map((conv) => (
        <ChatItem key={conv.id} {...buildChatItemProps(props, conv)} />
      ))}
    </div>
  );
}
