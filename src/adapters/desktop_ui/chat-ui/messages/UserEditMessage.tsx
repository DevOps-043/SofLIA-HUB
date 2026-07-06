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
      <div className="flex justify-end items-center gap-3 pt-3.5 border-t border-gray-200/50 dark:border-white/[0.06]">
        <button
          onClick={() => editing.setMessageId(null)}
          className="px-4 py-1.5 text-[12.5px] font-semibold text-gray-500 hover:text-gray-900 dark:text-white/40 dark:hover:text-white bg-transparent hover:bg-gray-100/50 dark:hover:bg-white/[0.03] border border-gray-200 dark:border-white/[0.08] rounded-xl transition-all"
        >
          Cancelar
        </button>
        <button
          onClick={() => {
            if (!controller.props.canSendMessages) return;
            controller.runtime.chat.handleEditMessage(message.id, editing.value, message.images || []);
            editing.setMessageId(null);
          }}
          disabled={!controller.props.canSendMessages}
          className="px-5 py-1.5 bg-accent hover:bg-accent/90 text-white rounded-xl text-[12.5px] font-semibold shadow-md shadow-accent/10 active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Enviar
        </button>
      </div>
    </div>
  );
}
