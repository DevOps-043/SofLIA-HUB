import type React from 'react';

type FlowModeControlsProps = {
  closeFlowMode: () => void;
  handleMicAction: () => Promise<void>;
  isComposerOpen: boolean;
  isListening: boolean;
  isProcessing: boolean;
  isRunning: boolean;
  setIsComposerOpen: React.Dispatch<React.SetStateAction<boolean>>;
};

export function FlowModeControls({
  closeFlowMode,
  handleMicAction,
  isComposerOpen,
  isListening,
  isProcessing,
  isRunning,
  setIsComposerOpen,
}: FlowModeControlsProps) {
  return (
    <div className="pointer-events-auto flex items-center gap-1.5 rounded-full border border-white/10 bg-[#07090d]/86 px-2.5 py-2.5 shadow-[0_20px_64px_-32px_rgba(0,0,0,0.95)] backdrop-blur-2xl">
      <button
        onClick={() => setIsComposerOpen((prev) => !prev)}
        className={`flex h-10 w-10 items-center justify-center rounded-full border transition ${isComposerOpen ? 'border-[#7ef0de]/30 bg-[#0d1b1a] text-[#9de7d6]' : 'border-white/8 bg-white/[0.03] text-[#90a4a1] hover:text-white'}`}
        aria-label="Abrir escritura"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5Z" />
        </svg>
      </button>
      <button
        onClick={() => void handleMicAction()}
        disabled={isProcessing || isRunning}
        className={`relative flex h-14 w-14 items-center justify-center rounded-full transition ${isListening ? 'bg-[#7ef0de] text-[#041111] shadow-[0_0_0_6px_rgba(126,240,222,0.14)]' : 'bg-white text-[#0a1114] shadow-[0_12px_28px_-18px_rgba(255,255,255,0.45)]'} disabled:opacity-55`}
        aria-label={isListening ? 'Detener microfono' : 'Activar microfono'}
      >
        {isListening ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <rect x="7" y="7" width="10" height="10" rx="2" />
          </svg>
        ) : (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3">
            <path d="M12 3a3 3 0 0 0-3 3v5a3 3 0 1 0 6 0V6a3 3 0 0 0-3-3Z" />
            <path d="M19 10v1a7 7 0 0 1-14 0v-1" />
            <path d="M12 18v3" />
            <path d="M8 21h8" />
          </svg>
        )}
      </button>
      <button onClick={closeFlowMode} className="flex h-10 w-10 items-center justify-center rounded-full border border-white/8 bg-white/[0.03] text-[#90a4a1] transition hover:text-white" aria-label="Cerrar voz">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
