import type { ChatMessage } from '../../../../services/chat-service';
import type { ChatUIController } from '../useChatUIController';

export function ModelMessageActions({
  controller,
  message,
}: {
  controller: ChatUIController;
  message: ChatMessage;
}) {
  const chat = controller.runtime.chat;

  return (
    <div className="flex gap-0.5 mt-1.5 select-none">
      <button
        className={`w-6 h-6 flex items-center justify-center rounded transition-all ${chat.copiedId === message.id ? 'text-green-500 bg-green-500/10' : 'text-[#c5c5d2] hover:bg-gray-100 dark:hover:bg-white/5 hover:text-gray-700 dark:hover:text-gray-200'}`}
        title={chat.copiedId === message.id ? 'Copiado' : 'Copiar texto'}
        onClick={() => chat.handleCopy(message.id, message.text)}
      >
        {chat.copiedId === message.id ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
        )}
      </button>
      {controller.props.canSendMessages && (
        <>
          <button className="w-6 h-6 flex items-center justify-center rounded text-[#c5c5d2] hover:bg-gray-100 dark:hover:bg-white/5 hover:text-gray-700 dark:hover:text-gray-200 transition-all" title="Regenerar respuesta" onClick={() => chat.handleRegenerate(message.id)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 4v6h-6"></path><path d="M1 20v-6h6"></path><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 1 8.51 15"></path></svg>
          </button>
          <button className={`w-6 h-6 flex items-center justify-center rounded transition-all ${message.feedback === 'like' ? 'text-[#8ab4f8]' : 'text-[#c5c5d2] hover:bg-gray-100 dark:hover:bg-white/5 hover:text-gray-700 dark:hover:text-gray-200'}`} title="Me gusta" onClick={() => chat.handleFeedback(message.id, 'like')}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path></svg>
          </button>
          <button className={`w-6 h-6 flex items-center justify-center rounded transition-all ${message.feedback === 'dislike' ? 'text-[#e57373]' : 'text-[#c5c5d2] hover:bg-gray-100 dark:hover:bg-white/5 hover:text-gray-700 dark:hover:text-gray-200'}`} title="No me gusta" onClick={() => chat.handleFeedback(message.id, 'dislike')}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.31 2.31H17"></path></svg>
          </button>
        </>
      )}
    </div>
  );
}
