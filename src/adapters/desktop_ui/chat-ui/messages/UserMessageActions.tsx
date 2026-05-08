import type { ChatMessage } from '../../../../services/chat-service';
import type { ChatUIController } from '../useChatUIController';

export function UserMessageActions({
  controller,
  message,
}: {
  controller: ChatUIController;
  message: ChatMessage;
}) {
  const chat = controller.runtime.chat;

  return (
    <div className="absolute -left-12 top-0 flex flex-col gap-1 opacity-0 group-hover/msg-content:opacity-100 transition-all duration-200">
      {controller.props.canSendMessages && (
        <button
          onClick={() => {
            controller.state.editing.setMessageId(message.id);
            controller.state.editing.setValue(message.text);
          }}
          className="p-2 rounded-xl bg-white dark:bg-[#2A2B32] text-gray-400 hover:text-accent hover:shadow-md border border-gray-100 dark:border-white/10 transition-all"
          title="Editar mensaje"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
          </svg>
        </button>
      )}
      <button
        onClick={() => chat.handleCopy(message.id, message.text)}
        className={`p-2 rounded-xl transition-all border ${chat.copiedId === message.id ? 'bg-green-500/10 text-green-500 border-green-500/20' : 'bg-white dark:bg-[#2A2B32] text-gray-400 hover:text-accent hover:shadow-md border-gray-100 dark:border-white/10'}`}
        title={chat.copiedId === message.id ? 'Copiado' : 'Copiar mensaje'}
      >
        {chat.copiedId === message.id ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
        )}
      </button>
    </div>
  );
}
