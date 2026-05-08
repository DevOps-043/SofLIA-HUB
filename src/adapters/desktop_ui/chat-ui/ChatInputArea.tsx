import { AttachmentPreviewStrip } from './input/AttachmentPreviewStrip';
import { ModeBadges } from './input/ModeBadges';
import { ToolMenu } from './input/ToolMenu';
import type { ChatUIController } from './useChatUIController';

export function ChatInputArea({ controller }: { controller: ChatUIController }) {
  const input = controller.state.input;
  const chat = controller.runtime.chat;
  const canSend = controller.props.canSendMessages;
  const modes = controller.state.modes;
  const placeholder = !canSend
    ? controller.props.readOnlyReason || 'Conversacion en solo lectura'
    : modes.imageGen
      ? 'Describe la imagen que quieres generar...'
      : modes.promptOptimizer
        ? 'Escribe el prompt a optimizar...'
        : 'Mensaje a SOFLIA...';

  return (
    <div className="flex-shrink-0 px-4 pb-4 pt-2 bg-background dark:bg-background-dark">
      <div className="max-w-3xl mx-auto">
        <ModeBadges controller={controller} />
        <AttachmentPreviewStrip controller={controller} />
        <div className="w-full bg-[#f0f2f5] dark:bg-[#2A2B32] rounded-[30px] border border-transparent focus-within:border-gray-300 dark:focus-within:border-gray-500 transition-all flex items-end gap-2 px-2 py-1.5 mt-1 relative">
          <ToolMenu controller={controller} />
          <textarea
            value={input.value}
            onChange={(event) => input.set(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                controller.onSendClick();
              }
            }}
            onPaste={controller.files.handlePaste}
            placeholder={placeholder}
            className="flex-1 bg-transparent text-[15px] focus:outline-none placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-gray-100 resize-none max-h-[160px] overflow-y-auto !no-scrollbar font-sans py-2.5 px-2 leading-relaxed mb-0.5"
            rows={1}
            disabled={chat.showLoadingUI || !canSend}
            style={{ height: '42px', scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            onInput={(event) => {
              const target = event.target as HTMLTextAreaElement;
              target.style.height = '42px';
              target.style.height = `${Math.min(target.scrollHeight, 160)}px`;
            }}
          />
          <div className="flex items-center gap-1.5 pr-0.5 self-end pb-1.5">
            {input.value.trim() || controller.dictation.isRecording ? (
              <button
                onClick={controller.dictation.isRecording ? () => controller.dictation.stopDictation(true) : controller.onSendClick}
                disabled={!controller.dictation.isRecording && (chat.showLoadingUI || !canSend)}
                className="w-9 h-9 flex items-center justify-center rounded-full bg-accent hover:bg-accent/80 text-white shadow-md transition-all disabled:opacity-50"
                title={controller.dictation.isRecording ? 'Detener dictado' : 'Enviar mensaje'}
              >
                {chat.showLoadingUI && !controller.dictation.isRecording ? '...' : controller.dictation.isRecording ? '■' : '➤'}
              </button>
            ) : (
              <button
                onClick={controller.dictation.toggleDictation}
                disabled={!canSend}
                className="w-9 h-9 flex items-center justify-center rounded-full transition-all bg-white dark:bg-black/20 text-gray-500 hover:text-accent border border-gray-200 dark:border-white/5"
                title="Dictado por voz"
              >
                mic
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
