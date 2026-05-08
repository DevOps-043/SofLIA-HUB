import { FlowModeAnalysis } from './FlowModeAnalysis';
import { FlowModeComposer } from './FlowModeComposer';
import { FlowModeHeader } from './FlowModeHeader';
import { FlowModeStatus } from './FlowModeStatus';
import { FlowModeTranscript } from './FlowModeTranscript';
import type { FlowModePanelProps } from './types';

export function FlowModePanel(props: FlowModePanelProps) {
  if (!props.showPanel) return null;

  const canClear = Boolean(
    props.analysis || props.liveTranscript || props.errorMessage || props.executionState.status !== 'idle',
  );

  return (
    <div className="pointer-events-auto w-full max-w-[560px] overflow-hidden rounded-[32px] border border-white/10 bg-[#07090d]/88 p-4 shadow-[0_30px_100px_-32px_rgba(0,0,0,0.95)] backdrop-blur-2xl">
      <div className="custom-scrollbar max-h-[calc(100vh-170px)] overflow-y-auto rounded-[26px] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.015))] p-4 sm:p-5">
        <FlowModeHeader
          canClear={canClear}
          panelLabel={props.panelLabel}
          resetResult={props.resetResult}
          resetTranscript={props.resetTranscript}
        />

        {props.isComposerOpen && (
          <FlowModeComposer
            disabled={props.isProcessing || props.executionState.status === 'running'}
            handleManualTextSubmit={props.handleManualTextSubmit}
            inputText={props.inputText}
            setInputText={props.setInputText}
            textareaRef={props.textareaRef}
          />
        )}

        {(props.isListening || props.liveTranscript) && (
          <FlowModeTranscript
            transcriptFinal={props.transcriptFinal}
            transcriptInterim={props.transcriptInterim}
          />
        )}

        <FlowModeStatus
          errorMessage={props.errorMessage}
          executionState={props.executionState}
          isProcessing={props.isProcessing && !props.analysis}
          processingMode={props.processingMode}
        />

        {props.analysis && <FlowModeAnalysis action={props.action} analysis={props.analysis} />}

        {props.canExecuteAction && props.action && (
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-white/8 pt-4">
            <button
              onClick={() => void props.runAction(props.action!)}
              disabled={props.executionState.status === 'running'}
              className="rounded-full bg-[#7ef0de] px-4 py-2.5 text-[13px] font-semibold text-[#051110] transition hover:brightness-105 disabled:opacity-55"
            >
              {props.action.label}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
