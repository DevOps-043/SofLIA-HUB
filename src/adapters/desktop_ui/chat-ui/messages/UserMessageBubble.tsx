import type { ChatMessage } from '../../../../services/chat-service';
import type { ChatUIController } from '../useChatUIController';
import { MessageAttachments } from './MessageAttachments';
import { UserEditMessage } from './UserEditMessage';
import { UserMessageActions } from './UserMessageActions';

export function UserMessageBubble({
  controller,
  message,
}: {
  controller: ChatUIController;
  message: ChatMessage;
}) {
  const isEditing = controller.state.editing.messageId === message.id;

  return (
    <>
      <MessageAttachments images={message.images} onZoom={controller.state.images.setZoomed} />
      <div className={`${isEditing ? 'w-full bg-gray-50 dark:bg-[#161B22]/95 rounded-2xl p-4 shadow-2xl border border-gray-200/50 dark:border-white/[0.08] backdrop-blur-xl' : 'px-4 py-2.5 rounded-2xl bg-[#0A2540] dark:bg-[#00D4B3] text-white dark:text-[#0A0D12] rounded-tr-sm shadow-sm font-medium'} text-[15px] leading-relaxed group/msg-content relative transition-all duration-300`}>
        {isEditing ? (
          <UserEditMessage controller={controller} message={message} />
        ) : (
          <>
            <div className="flex min-w-0 flex-col whitespace-pre-wrap break-words">{message.text}</div>
            <UserMessageActions controller={controller} message={message} />
          </>
        )}
      </div>
    </>
  );
}
