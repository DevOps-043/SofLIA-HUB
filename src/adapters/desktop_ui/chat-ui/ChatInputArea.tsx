import { useLayoutEffect, useRef } from 'react';
import { AttachmentPreviewStrip } from './input/AttachmentPreviewStrip';
import { ModeBadges } from './input/ModeBadges';
import { ToolMenu } from './input/ToolMenu';
import { SkillCommandMenu } from './input/SkillCommandMenu';
import { StarterPrompts } from './input/StarterPrompts';
import type { ChatUIController } from './useChatUIController';
import { SelectionAttachmentChip } from './SelectionAttachmentChip';
import { TabAttachmentChips } from './input/TabAttachmentChips';
import { AppAttachmentChips } from './input/AppAttachmentChips';

export function ChatInputArea({ controller }: { controller: ChatUIController }) {
  const input = controller.state.input;
  const chat = controller.runtime.chat;
  const canSend = controller.props.canSendMessages;
  const modes = controller.state.modes;
  const compact = controller.props.compact === true;
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const placeholder = !canSend
    ? controller.props.readOnlyReason || 'Conversacion en solo lectura'
    : modes.imageGen
      ? 'Describe la imagen que quieres generar...'
      : modes.promptOptimizer
        ? 'Escribe el prompt a optimizar...'
        : compact ? 'Escribe a SofLIA...' : 'Mensaje a SOFLIA...';

  useLayoutEffect(() => {
    const target = textareaRef.current;
    if (!target) return;
    const baseHeight = compact ? 30 : 36;
    target.style.height = `${baseHeight}px`;
    target.style.height = `${Math.min(Math.max(baseHeight, target.scrollHeight), compact ? 112 : 160)}px`;
  }, [compact, input.value]);

  return (
    <div className={`min-w-0 flex-shrink-0 overflow-hidden bg-background dark:bg-background-dark ${compact ? 'px-2 pb-2 pt-1' : 'px-4 pb-3 pt-1.5'}`}>
      <div className="mx-auto min-w-0 max-w-5xl">
        <ModeBadges controller={controller} />
        <AttachmentPreviewStrip controller={controller} />
        <TabAttachmentChips
          attachedTabs={controller.state.tabs?.attached ?? []}
          onRemoveTab={(tabId) => {
            controller.state.tabs?.setAttached(
              (controller.state.tabs?.attached ?? []).filter((t) => t.tabId !== tabId)
            );
          }}
        />
        <AppAttachmentChips
          attachedApps={controller.state.apps?.attached ?? []}
          onRemoveApp={(appId) => {
            controller.state.apps?.setAttached(
              (controller.state.apps?.attached ?? []).filter((app) => app.appId !== appId)
            );
            controller.state.apps?.extractions.current.delete(appId);
          }}
        />
        <SelectionAttachmentChip
          selection={controller.state.selection.value}
          onDismiss={() => controller.state.selection.set(null)}
        />
        <StarterPrompts controller={controller} />
        {controller.skillCommands.visible && (
          <SkillCommandMenu
            matches={controller.skillCommands.matches}
            highlighted={controller.skillCommands.highlighted}
            onHighlight={controller.skillCommands.setHighlighted}
            onSelect={controller.skillCommands.activate}
          />
        )}
        <div className={`relative mt-1 flex w-full items-center border border-border/70 bg-surface-2 transition-all focus-within:border-accent/40 focus-within:ring-2 focus-within:ring-accent/12 ${compact ? 'gap-1 rounded-[18px] px-1 py-1' : 'gap-1.5 rounded-[24px] px-1.5 py-1'}`} style={{ fontFamily: 'var(--font-system-ui)' }}>
          <ToolMenu controller={controller} />
          <div className="relative min-w-0 flex-1">
            {compact && !input.value && (
              <span aria-hidden="true" className="pointer-events-none absolute inset-x-1 top-1/2 -translate-y-1/2 truncate text-[12px] leading-[18px] text-secondary">
                {placeholder}
              </span>
            )}
            <textarea
              ref={textareaRef}
              value={input.value}
              onChange={(event) => input.set(event.target.value)}
              onKeyDown={(event) => {
                // El menu de skills tiene prioridad: si consume la tecla, el
                // compositor no debe enviar el mensaje.
                if (controller.skillCommands.handleKeyDown(event)) return;
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  controller.onSendClick();
                }
              }}
              onPaste={controller.files.handlePaste}
              placeholder={compact ? '' : placeholder}
              aria-label={placeholder}
              className={`!no-scrollbar min-w-0 w-full resize-none overflow-y-auto bg-transparent text-gray-900 placeholder:text-secondary focus:outline-none dark:text-gray-100 ${compact ? 'px-1 py-[6px] text-[12px] leading-[18px]' : 'px-2 py-[7px] text-[14px] leading-[22px]'}`}
              rows={1}
              disabled={chat.showLoadingUI || !canSend}
              style={{ height: compact ? '30px' : '36px', scrollbarWidth: 'none', msOverflowStyle: 'none', fontFamily: 'var(--font-system-ui)' }}
            />
          </div>
          <div className="flex items-center gap-1 pr-0.5">
            {chat.showLoadingUI ? (
              <button
                onClick={controller.onStopClick}
                className={`${compact ? 'h-[30px] w-[30px]' : 'h-[34px] w-[34px]'} flex items-center justify-center rounded-full bg-red-500 hover:bg-red-600 text-white shadow-sm transition-all animate-pulse`}
                title="Detener lo que SOFLIA está haciendo"
                aria-label="Detener"
              >
                <span className="block w-3 h-3 rounded-[3px] bg-white" />
              </button>
            ) : input.value.trim() || controller.dictation.isRecording ? (
              <button
                onClick={controller.dictation.isRecording ? () => controller.dictation.stopDictation(true) : controller.onSendClick}
                disabled={!controller.dictation.isRecording && (chat.showLoadingUI || !canSend || controller.dictation.isTranscribing)}
                className={`${compact ? 'h-[30px] w-[30px]' : 'h-[34px] w-[34px]'} flex items-center justify-center rounded-full bg-accent hover:bg-accent/80 text-on-accent shadow-sm transition-all disabled:opacity-50`}
                title={controller.dictation.isRecording ? 'Detener dictado' : controller.dictation.isTranscribing ? 'Transcribiendo audio' : 'Enviar mensaje'}
              >
                {(chat.showLoadingUI || controller.dictation.isTranscribing) && !controller.dictation.isRecording ? '...' : controller.dictation.isRecording ? '■' : '➤'}
              </button>
            ) : (
              <button
                onClick={controller.dictation.toggleDictation}
                disabled={!canSend || controller.dictation.isTranscribing}
                className={`${compact ? 'h-[30px] w-[30px]' : 'h-[34px] w-[34px]'} flex items-center justify-center rounded-full border border-border bg-card text-secondary transition-all hover:border-accent/25 hover:text-accent`}
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
