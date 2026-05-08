import { useEffect } from 'react';
import { FlowModeControls } from './flow-mode/FlowModeControls';
import { FlowModePanel } from './flow-mode/FlowModePanel';
import type { FlowBridge, FlowModeProps } from './flow-mode/types';
import { useFlowCaptureLifecycle } from './flow-mode/useFlowCaptureLifecycle';
import { useFlowProcessing } from './flow-mode/useFlowProcessing';

export function FlowMode({ isActive, onClose, onSendToChat }: FlowModeProps) {
  const capture = useFlowCaptureLifecycle();
  const flowApi = (window as typeof window & { flow?: FlowBridge }).flow;
  const flow = useFlowProcessing({ capture, flowApi, onClose, onSendToChat });

  async function handleMicAction(): Promise<void> {
    if (flow.isProcessing || flow.executionState.status === 'running') return;
    if (capture.isListening) {
      if (capture.listeningMode === 'speech') capture.stopSpeechRecognition(true);
      else if (capture.listeningMode === 'audio') capture.stopAudioRecording(true);
      return;
    }
    await capture.startSpeechRecognition(flow.handleTranscriptResult, flow.resetResult, flow.setErrorMessage, flow.setIsProcessing);
  }

  function closeFlowMode(): void {
    capture.teardownCapture(false);
    capture.resetTranscript();
    flow.resetResult();
    flow.setInputText('');
    flow.setIsComposerOpen(false);
    onClose();
  }

  useEffect(() => {
    if (!isActive) capture.teardownCapture(false);
    return () => capture.teardownCapture(false);
  }, [isActive]);

  useEffect(() => {
    if (flow.isComposerOpen) window.setTimeout(() => flow.textareaRef.current?.focus(), 40);
  }, [flow.isComposerOpen]);

  if (!isActive) return null;

  return (
    <div
      className="relative flex h-full w-full items-end justify-center px-4 pb-6 pt-6 sm:px-6 sm:pb-8"
      style={{ fontFamily: '"Aptos", "Segoe UI Variable Text", "Segoe UI", sans-serif' }}
    >
      <div className="relative z-10 flex w-full flex-col items-center gap-4">
        <FlowModePanel
          action={flow.action}
          analysis={flow.analysis}
          canExecuteAction={flow.canExecuteAction}
          errorMessage={flow.errorMessage}
          executionState={flow.executionState}
          handleManualTextSubmit={flow.handleManualTextSubmit}
          inputText={flow.inputText}
          isComposerOpen={flow.isComposerOpen}
          isListening={capture.isListening}
          isProcessing={flow.isProcessing}
          liveTranscript={capture.liveTranscript}
          panelLabel={flow.panelLabel}
          processingMode={flow.processingMode}
          resetResult={flow.resetResult}
          resetTranscript={capture.resetTranscript}
          runAction={flow.runAction}
          setInputText={flow.setInputText}
          showPanel={flow.showPanel}
          textareaRef={flow.textareaRef}
          transcriptFinal={capture.transcriptFinal}
          transcriptInterim={capture.transcriptInterim}
        />
        <FlowModeControls
          closeFlowMode={closeFlowMode}
          handleMicAction={handleMicAction}
          isComposerOpen={flow.isComposerOpen}
          isListening={capture.isListening}
          isProcessing={flow.isProcessing}
          isRunning={flow.executionState.status === 'running'}
          setIsComposerOpen={flow.setIsComposerOpen}
        />
      </div>
    </div>
  );
}
