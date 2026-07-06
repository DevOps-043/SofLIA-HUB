import type { ChatMessage } from '../../../../services/chat-service';
import type { ChatUIController } from '../useChatUIController';
import { CopyIcon, CheckIcon, EditIcon } from '../../../../components/ui/Icons';

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
          className="w-7 h-7 flex items-center justify-center rounded-xl bg-white dark:bg-[#2A2B32] text-gray-400 hover:text-accent hover:shadow-md border border-gray-100 dark:border-white/10 transition-all"
          title="Editar mensaje"
        >
          <EditIcon size={13} />
        </button>
      )}
      <button
        onClick={() => chat.handleCopy(message.id, message.text)}
        className={`w-7 h-7 flex items-center justify-center rounded-xl transition-all border ${
          chat.copiedId === message.id
            ? 'bg-green-500/10 text-green-500 border-green-500/20'
            : 'bg-white dark:bg-[#2A2B32] text-gray-400 hover:text-accent hover:shadow-md border-gray-100 dark:border-white/10'
        }`}
        title={chat.copiedId === message.id ? 'Copiado' : 'Copiar mensaje'}
      >
        {chat.copiedId === message.id ? (
          <CheckIcon size={13} />
        ) : (
          <CopyIcon size={13} />
        )}
      </button>
    </div>
  );
}
