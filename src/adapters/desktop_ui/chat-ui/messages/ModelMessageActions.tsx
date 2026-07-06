import type { ChatMessage } from '../../../../services/chat-service';
import type { ChatUIController } from '../useChatUIController';
import { CopyIcon, CheckIcon, RefreshIcon, ThumbsUpIcon, ThumbsDownIcon } from '../../../../components/ui/Icons';

export function ModelMessageActions({
  controller,
  message,
}: {
  controller: ChatUIController;
  message: ChatMessage;
}) {
  const chat = controller.runtime.chat;

  return (
    <div className="flex gap-1 mt-2.5 select-none">
      <button
        className={`w-7 h-7 flex items-center justify-center rounded-xl transition-all duration-150 ${
          chat.copiedId === message.id
            ? 'text-green-500 bg-green-500/10'
            : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-white/[0.04] hover:text-gray-700 dark:hover:text-white/80'
        }`}
        title={chat.copiedId === message.id ? 'Copiado' : 'Copiar texto'}
        onClick={() => chat.handleCopy(message.id, message.text)}
      >
        {chat.copiedId === message.id ? (
          <CheckIcon size={13} />
        ) : (
          <CopyIcon size={13} />
        )}
      </button>
      {controller.props.canSendMessages && (
        <>
          <button
            className="w-7 h-7 flex items-center justify-center rounded-xl text-gray-400 hover:bg-gray-100 dark:hover:bg-white/[0.04] hover:text-gray-700 dark:hover:text-white/80 transition-all duration-150"
            title="Regenerar respuesta"
            onClick={() => chat.handleRegenerate(message.id)}
          >
            <RefreshIcon size={13} />
          </button>
          <button
            className={`w-7 h-7 flex items-center justify-center rounded-xl transition-all duration-150 ${
              message.feedback === 'like'
                ? 'text-accent bg-accent/10'
                : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-white/[0.04] hover:text-gray-700 dark:hover:text-white/80'
            }`}
            title="Me gusta"
            onClick={() => chat.handleFeedback(message.id, 'like')}
          >
            <ThumbsUpIcon size={13} fill={message.feedback === 'like' ? 'currentColor' : 'none'} />
          </button>
          <button
            className={`w-7 h-7 flex items-center justify-center rounded-xl transition-all duration-150 ${
              message.feedback === 'dislike'
                ? 'text-red-500 bg-red-500/10'
                : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-white/[0.04] hover:text-gray-700 dark:hover:text-white/80'
            }`}
            title="No me gusta"
            onClick={() => chat.handleFeedback(message.id, 'dislike')}
          >
            <ThumbsDownIcon size={13} fill={message.feedback === 'dislike' ? 'currentColor' : 'none'} />
          </button>
        </>
      )}
    </div>
  );
}
