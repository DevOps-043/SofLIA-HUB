import { ChatLoadingIndicator } from '../ChatLoadingIndicator';
import type { ChatUIController } from '../useChatUIController';
import { ChatMessageItem } from './ChatMessageItem';

export function MessageList({ controller }: { controller: ChatUIController }) {
  const messages = controller.props.messages;
  const chat = controller.runtime.chat;
  const latestAssistantIndex = messages.map(message => message.role).lastIndexOf('model');
  const { messagesEndRef } = controller.refs;

  return (
    <div className="min-w-0 flex-1">
      <div className="mx-auto min-w-0 max-w-5xl space-y-6 overflow-hidden px-4 py-6">
        {messages.map((message, index) => {
          if (chat.showLoadingUI && index === messages.length - 1 && message.role === 'model' && (!message.text || message.text === '...')) {
            return null;
          }
          return <ChatMessageItem key={message.id} controller={controller} message={message} activeAvatar={!chat.showLoadingUI && index === latestAssistantIndex} />;
        })}
        {chat.showLoadingUI && <ChatLoadingIndicator activeToolCall={chat.activeToolCall} />}
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
}
