import { EmptyChatState } from './EmptyChatState';
import { ChatHeader } from './header/ChatHeader';
import { MessageList } from './messages/MessageList';
import { ReadOnlyBanner } from './ReadOnlyBanner';
import type { ChatUIController } from './useChatUIController';

export function MessagesViewport({ controller }: { controller: ChatUIController }) {
  const messages = controller.props.messages;
  const chat = controller.runtime.chat;

  return (
    <div className="flex-1 overflow-y-auto no-scrollbar flex flex-col" onScroll={controller.handleScroll}>
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
