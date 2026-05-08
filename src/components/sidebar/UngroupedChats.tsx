import { ChatItem } from './ChatItem';
import { buildChatItemProps, splitChatsByFolder } from './chatProps';
import type { SidebarProps } from './types';

export function UngroupedChats({ props }: { props: SidebarProps }) {
  const { ungroupedChats } = splitChatsByFolder(props);

  return (
    <>
      {props.isOpen && (
        <div className="pt-5 pb-2 px-3">
          <span className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-[0.15em] font-semibold">
            {props.folders.length > 0 ? 'Sin carpeta' : 'Conversaciones'}
          </span>
        </div>
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
      <div className="px-3 py-4 text-center">
        <p className="text-xs text-gray-400 dark:text-gray-500">Sin conversaciones aun</p>
      </div>
    ) : null;
  }
  return ungroupedChats.map((conv) => (
    <ChatItem key={conv.id} {...buildChatItemProps(props, conv)} />
  ));
}

function LoadingDots() {
  return (
    <div className="px-3 py-4 text-center">
      <div className="flex gap-1 justify-center">
        <div className="w-1.5 h-1.5 bg-gray-400 dark:bg-gray-500 rounded-full animate-pulse" />
        <div className="w-1.5 h-1.5 bg-gray-400 dark:bg-gray-500 rounded-full animate-pulse [animation-delay:0.2s]" />
        <div className="w-1.5 h-1.5 bg-gray-400 dark:bg-gray-500 rounded-full animate-pulse [animation-delay:0.4s]" />
      </div>
    </div>
  );
}
