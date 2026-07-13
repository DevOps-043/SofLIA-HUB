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
      <div className="max-w-5xl mx-auto">
        <ModeBadges controller={controller} />
        <AttachmentPreviewStrip controller={controller} />
        <div className="w-full bg-[#f0f2f5] dark:bg-[#2A2B32] rounded-[30px] border border-transparent focus-within:border-accent/40 focus-within:ring-2 focus-within:ring-accent/15 focus-within:shadow-[0_0_12px_rgba(0,212,179,0.12)] transition-all flex items-center gap-2 px-2 py-1.5 mt-1 relative">
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
            className="flex-1 bg-transparent text-[15px] focus:outline-none placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-gray-100 resize-none max-h-[160px] overflow-y-auto !no-scrollbar font-sans py-2 px-2 leading-relaxed mb-0.5"
            rows={1}
            disabled={chat.showLoadingUI || !canSend}
            style={{ height: '38px', scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            onInput={(event) => {
              const target = event.target as HTMLTextAreaElement;
              target.style.height = '38px';
              target.style.height = `${Math.min(target.scrollHeight, 160)}px`;
            }}
          />
          <div className="flex items-center gap-1.5 pr-0.5">
            {chat.showLoadingUI ? (
              <button
                onClick={controller.onStopClick}
                className="w-9 h-9 flex items-center justify-center rounded-full bg-red-500 hover:bg-red-600 text-white shadow-md transition-all animate-pulse"
                title="Detener lo que SOFLIA está haciendo"
                aria-label="Detener"
              >
                <span className="block w-3 h-3 rounded-[3px] bg-white" />
              </button>
            ) : input.value.trim() || controller.dictation.isRecording ? (
              <button
                onClick={controller.dictation.isRecording ? () => controller.dictation.stopDictation(true) : controller.onSendClick}
                disabled={!controller.dictation.isRecording && (chat.showLoadingUI || !canSend || controller.dictation.isTranscribing)}
                className="w-9 h-9 flex items-center justify-center rounded-full bg-accent hover:bg-accent/80 text-white shadow-md transition-all disabled:opacity-50"
                title={controller.dictation.isRecording ? 'Detener dictado' : controller.dictation.isTranscribing ? 'Transcribiendo audio' : 'Enviar mensaje'}
              >
                {(chat.showLoadingUI || controller.dictation.isTranscribing) && !controller.dictation.isRecording ? '...' : controller.dictation.isRecording ? '■' : '➤'}
              </button>
            ) : (
              <button
                onClick={controller.dictation.toggleDictation}
                disabled={!canSend || controller.dictation.isTranscribing}
                className="w-9 h-9 flex items-center justify-center rounded-full transition-all bg-white dark:bg-white/[0.04] text-gray-500 hover:text-accent dark:hover:text-accent hover:shadow-sm border border-gray-200 dark:border-white/[0.06]"
                title={controller.dictation.errorMessage || 'Dictado por voz'}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
