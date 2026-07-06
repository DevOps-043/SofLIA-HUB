import { ChatLoadingIndicator } from '../ChatLoadingIndicator';
import type { ChatUIController } from '../useChatUIController';
import { ChatMessageItem } from './ChatMessageItem';

export function MessageList({ controller }: { controller: ChatUIController }) {
  const messages = controller.props.messages;
  const chat = controller.runtime.chat;

  return (
    <div className="flex-1">
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {messages.map((message, index) => {
          if (chat.showLoadingUI && index === messages.length - 1 && message.role === 'model' && (!message.text || message.text === '...')) {
            return null;
          }
          return <ChatMessageItem key={message.id} controller={controller} message={message} />;
        })}
        {chat.showLoadingUI && <ChatLoadingIndicator activeToolCall={chat.activeToolCall} />}
        <div ref={controller.refs.messagesEndRef} />
      </div>
    </div>
  );
}
