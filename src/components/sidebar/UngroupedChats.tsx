import { ChatItem } from './ChatItem';
import { buildChatItemProps, splitChatsByFolder } from './chatProps';
import { SidebarSectionLabel } from './SidebarSectionLabel';
import type { SidebarProps } from './types';

export function UngroupedChats({ props }: { props: SidebarProps }) {
  const { ungroupedChats } = splitChatsByFolder(props);

  return (
    <>
      {props.isOpen && (
        <SidebarSectionLabel label={props.folders.length > 0 ? 'Sin carpeta' : 'Conversaciones'} />
      )}
      {renderUngroupedBody(props, ungroupedChats)}
    </>
  );
}

function renderUngroupedBody(props: SidebarProps, ungroupedChats: ReturnType<typeof splitChatsByFolder>['ungroupedChats']) {
  if (props.loadingConversations) {
    return props.isOpen ? <LoadingDots /> : null;
  }
  if (ungroupedChats.length === 0) {
    return props.isOpen ? (
      <div className="px-2 py-3 text-center">
        <p className="text-xs text-secondary/70 dark:text-white/40">Sin conversaciones aun</p>
      </div>
    ) : null;
  }
  return ungroupedChats.map((conv) => (
    <ChatItem key={conv.id} {...buildChatItemProps(props, conv)} />
  ));
}

function LoadingDots() {
  return (
    <div className="px-2 py-3 text-center">
      <div className="flex gap-1 justify-center">
        <div className="w-1.5 h-1.5 bg-accent/60 rounded-full animate-pulse" />
        <div className="w-1.5 h-1.5 bg-accent/40 rounded-full animate-pulse [animation-delay:0.2s]" />
        <div className="w-1.5 h-1.5 bg-accent/30 rounded-full animate-pulse [animation-delay:0.4s]" />
      </div>
    </div>
  );
}
