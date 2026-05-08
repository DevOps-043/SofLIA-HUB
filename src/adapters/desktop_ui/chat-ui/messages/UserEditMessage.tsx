import type { ChatMessage } from '../../../../services/chat-service';
import type { ChatUIController } from '../useChatUIController';

export function UserEditMessage({
  controller,
  message,
}: {
  controller: ChatUIController;
  message: ChatMessage;
}) {
  const editing = controller.state.editing;

  return (
    <div className="flex flex-col gap-4">
      <textarea
        value={editing.value}
        onChange={(event) => {
          editing.setValue(event.target.value);
          event.target.style.height = 'auto';
          event.target.style.height = `${event.target.scrollHeight}px`;
        }}
        className="w-full bg-transparent border-none focus:ring-0 outline-none p-0 text-[15.5px] min-h-[60px] text-gray-800 dark:text-gray-100 resize-none font-medium leading-relaxed"
        autoFocus
        placeholder="Edita tu mensaje..."
      />
      <div className="flex justify-end items-center gap-4 pt-4 border-t border-gray-300/30 dark:border-white/10">
        <button onClick={() => editing.setMessageId(null)} className="px-5 py-2 text-[13px] font-bold text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white transition-all bg-gray-200/50 dark:bg-white/5 rounded-full">
          Cancelar
        </button>
        <button
          onClick={() => {
            if (!controller.props.canSendMessages) return;
            controller.runtime.chat.handleEditMessage(message.id, editing.value, message.images || []);
            editing.setMessageId(null);
          }}
          disabled={!controller.props.canSendMessages}
          className="px-7 py-2 bg-accent text-white rounded-full text-[13px] font-black uppercase tracking-widest hover:brightness-110 active:scale-95 transition-all shadow-xl shadow-accent/20"
        >
          Enviar
        </button>
      </div>
    </div>
  );
}
