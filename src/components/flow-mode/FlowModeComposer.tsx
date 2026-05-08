import type React from 'react';

type FlowModeComposerProps = {
  disabled: boolean;
  handleManualTextSubmit: () => Promise<void>;
  inputText: string;
  setInputText: React.Dispatch<React.SetStateAction<string>>;
  textareaRef: React.RefObject<HTMLTextAreaElement>;
};

export function FlowModeComposer({
  disabled,
  handleManualTextSubmit,
  inputText,
  setInputText,
  textareaRef,
}: FlowModeComposerProps) {
  return (
    <div className="mt-4">
      <textarea
        ref={textareaRef}
        rows={3}
        value={inputText}
        onChange={(event) => setInputText(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            void handleManualTextSubmit();
          }
        }}
        disabled={disabled}
        placeholder="Escribe una solicitud o pega un texto..."
        className="custom-scrollbar min-h-[96px] w-full resize-none rounded-[22px] border border-white/8 bg-black/20 px-4 py-4 text-[15px] leading-7 text-white outline-none transition placeholder:text-[#708381] focus:border-[#7ef0de]/28 focus:bg-[#0d1316] disabled:opacity-60"
      />
    </div>
  );
}
