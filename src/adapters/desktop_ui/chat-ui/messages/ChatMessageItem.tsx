import { UserAvatar } from '../../../../components/chat/MarkdownRenderer';
import type { ChatMessage } from '../../../../services/chat-service';
import type { ChatUIController } from '../useChatUIController';
import { ModelMessageContent } from './ModelMessageContent';
import { UserMessageBubble } from './UserMessageBubble';

export function ChatMessageItem({
  controller,
  message,
}: {
  controller: ChatUIController;
  message: ChatMessage;
}) {
  const isEditing = controller.state.editing.messageId === message.id;
  const isUser = message.role === 'user';

  return (
    <div className={`flex min-w-0 gap-4 ${isUser && !isEditing ? 'justify-end' : ''}`}>
      {message.role === 'model' && (
        <div className="w-8 h-8 flex items-center justify-center flex-shrink-0 rounded-full overflow-hidden">
          <img src="./assets/lia-avatar.png" alt="SOFLIA" className="w-full h-full object-cover" />
        </div>
      )}
      {/* min-w-0 evita que el tamano minimo automatico del item flex (tablas,
          codigo o URLs largas) desborde el panel flotante del navegador: sin el,
          el contenido se sale y el contenedor superior lo recorta. */}
      <div className={`flex min-w-0 flex-col ${isEditing ? 'w-full' : 'max-w-[85%]'} ${isUser && !isEditing ? 'items-end' : 'items-start'}`}>
        {isUser ? <UserMessageBubble controller={controller} message={message} /> : <ModelMessageContent controller={controller} message={message} />}
      </div>
      {isUser && (
        <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center text-accent text-xs font-bold flex-shrink-0 overflow-hidden" title="Usuario">
          <UserAvatar src={controller.props.userAvatar} fallback={<div className="w-full h-full flex items-center justify-center bg-indigo-100 text-indigo-700">Tu</div>} />
        </div>
      )}
    </div>
  );
}
