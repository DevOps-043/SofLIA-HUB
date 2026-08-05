import { EmptyChatState } from './EmptyChatState';
import { ChatHeader } from './header/ChatHeader';
import { MessageList } from './messages/MessageList';
import { ReadOnlyBanner } from './ReadOnlyBanner';
import type { ChatUIController } from './useChatUIController';

export function MessagesViewport({ controller }: { controller: ChatUIController }) {
  const messages = controller.props.messages;
  const chat = controller.runtime.chat;

  return (
    <div className="no-scrollbar flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto" onScroll={controller.handleScroll}>
      <ChatHeader controller={controller} />
      {!controller.props.canSendMessages && <ReadOnlyBanner reason={controller.props.readOnlyReason} />}
      {messages.length === 0 && !chat.showLoadingUI ? (
        <EmptyChatState />
      ) : (
        <MessageList controller={controller} />
      )}
    </div>
  );
}
