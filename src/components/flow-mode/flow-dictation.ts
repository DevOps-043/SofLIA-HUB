import type { FlowAnalysisResult } from '../../services/flow-service';
import { shouldHandleAsAssistant } from './text-utils';
import type { ExecutionState, FlowBridge } from './types';
import type { FlowCaptureLifecycle } from './useFlowCaptureLifecycle';

interface HandleFlowDictationOptions {
  capture: FlowCaptureLifecycle;
  flowApi?: FlowBridge;
  isComposerOpen: boolean;
  onClose: () => void;
  rawText: string;
  resetResult: () => void;
  runFlowAnalysis: (text: string) => Promise<void>;
  setAnalysis: (analysis: FlowAnalysisResult | null) => void;
  setErrorMessage: (message: string) => void;
  setExecutionState: (state: ExecutionState) => void;
  setInputText: (value: string) => void;
  setIsComposerOpen: (open: boolean) => void;
  setIsProcessing: (processing: boolean) => void;
  setProcessingMode: (mode: 'assistant' | 'dictation') => void;
}

export async function handleFlowDictation(options: HandleFlowDictationOptions): Promise<void> {
  const text = options.rawText.trim();
  if (!text) return;

  options.capture.setTranscriptFinal(text);
  options.capture.setTranscriptInterim('');
  if (options.isComposerOpen || shouldHandleAsAssistant(text)) return options.runFlowAnalysis(text);
  if (!options.flowApi?.insertText) {
    options.setErrorMessage('El dictado directo no esta disponible en esta ventana.');
    return;
  }

  options.setIsProcessing(true);
  options.setProcessingMode('dictation');
  options.setErrorMessage('');
  options.setAnalysis(null);
  options.setExecutionState({ status: 'idle', message: '' });

  try {
    const result = await options.flowApi.insertText(text);
    if (result?.success === false) {
      options.setIsProcessing(false);
      if (result?.code === 'NO_TARGET') return options.runFlowAnalysis(text);
      options.setErrorMessage(result.error || 'No pude insertar el texto en el campo activo.');
      return;
    }

    options.setIsProcessing(false);
    options.capture.resetTranscript();
    options.resetResult();
    options.setInputText('');
    options.setIsComposerOpen(false);
    options.onClose();
  } catch (error: any) {
    options.setIsProcessing(false);
    options.setErrorMessage(error?.message || 'No pude insertar el texto en el campo activo.');
  }
}
