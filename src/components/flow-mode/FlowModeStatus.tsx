import type { ExecutionState } from './types';

type FlowModeStatusProps = {
  errorMessage: string;
  executionState: ExecutionState;
  isProcessing: boolean;
  processingMode: 'assistant' | 'dictation';
};

export function FlowModeStatus({
  errorMessage,
  executionState,
  isProcessing,
  processingMode,
}: FlowModeStatusProps) {
  return (
    <>
      {isProcessing && executionState.status === 'idle' && (
        <div className="mt-4 rounded-[24px] border border-white/8 bg-black/20 px-4 py-4 text-[15px] text-[#d8e2e1]">
          {processingMode === 'dictation' ? 'Insertando el dictado en el campo activo...' : 'Procesando tu solicitud...'}
        </div>
      )}

      {executionState.status !== 'idle' && (
        <div className={`mt-4 rounded-[24px] border px-4 py-4 ${
          executionState.status === 'success'
            ? 'border-[#1d564a] bg-[#0b231f]'
            : executionState.status === 'error'
              ? 'border-[#5b2820] bg-[#26100d]'
              : 'border-[#1f4750] bg-[#0b1820]'
        }`}>
          <div className="text-[11px] uppercase tracking-[0.24em] text-[#8da3a0]">Estado</div>
          <div className="mt-3 text-[15px] font-semibold text-white">{executionState.message}</div>
          {executionState.detail && <div className="mt-2 text-[13px] leading-6 text-[#c1cfce]">{executionState.detail}</div>}
        </div>
      )}

      {errorMessage && (
        <div className="mt-4 rounded-[24px] border border-[#5b2921] bg-[#23100d] px-4 py-4 text-[13px] text-[#ffb7a7]">
          {errorMessage}
        </div>
      )}
    </>
  );
}
