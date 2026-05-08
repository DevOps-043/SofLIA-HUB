import { useRef, useState } from 'react';
import { type FlowAction, type FlowAnalysisResult, processFlowInput } from '../../services/flow-service';
import { captureFlowScreenshot } from './capture-screenshot';
import { runFlowAction } from './flow-action-runner';
import { handleFlowDictation } from './flow-dictation';
import type { ExecutionState, FlowBridge } from './types';
import type { FlowCaptureLifecycle } from './useFlowCaptureLifecycle';

interface UseFlowProcessingOptions {
  capture: FlowCaptureLifecycle;
  flowApi?: FlowBridge;
  onClose: () => void;
  onSendToChat: (message: string) => void;
}

export function useFlowProcessing({ capture, flowApi, onClose, onSendToChat }: UseFlowProcessingOptions) {
  const [inputText, setInputText] = useState('');
  const [analysis, setAnalysis] = useState<FlowAnalysisResult | null>(null);
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingMode, setProcessingMode] = useState<'assistant' | 'dictation'>('assistant');
  const [errorMessage, setErrorMessage] = useState('');
  const [executionState, setExecutionState] = useState<ExecutionState>({ status: 'idle', message: '' });
  const requestSequenceRef = useRef(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const action = analysis?.action || null;
  const canExecuteAction = Boolean(action && analysis && analysis.missing.length === 0 && action.type !== 'send_to_chat');
  const showPanel = Boolean(isComposerOpen || capture.isListening || isProcessing || analysis || errorMessage || executionState.status !== 'idle');
  const panelLabel = capture.isListening ? 'Escuchando' : isProcessing ? (processingMode === 'dictation' ? 'Dictando' : 'Procesando') : analysis ? 'Respuesta' : 'Escritura';

  function resetResult(): void {
    setAnalysis(null);
    setExecutionState({ status: 'idle', message: '' });
    setErrorMessage('');
    setProcessingMode('assistant');
  }

  async function runAction(flowAction: FlowAction, analysisOverride?: FlowAnalysisResult | null): Promise<void> {
    await runFlowAction({ capture, currentAnalysis: analysisOverride || analysis, executionState, flowAction, onClose, onSendToChat, setExecutionState });
  }

  async function runFlowAnalysis(rawText: string): Promise<void> {
    const text = rawText.trim();
    if (!text) return;
    const requestId = requestSequenceRef.current + 1;
    requestSequenceRef.current = requestId;
    setIsProcessing(true);
    setProcessingMode('assistant');
    setErrorMessage('');
    setExecutionState({ status: 'idle', message: '' });
    setIsComposerOpen(false);
    capture.setTranscriptFinal(text);
    capture.setTranscriptInterim('');
    setAnalysis(null);
    try {
      const result = await processFlowInput(text, await captureFlowScreenshot());
      if (requestSequenceRef.current !== requestId) return;
      setAnalysis(result);
      setIsProcessing(false);
      const shouldAutoExecute = result.action && result.missing.length === 0 && (result.action.type === 'open_application' || result.action.type === 'open_url' || (result.action.type === 'desktop_automation' && result.action.autoExecute));
      if (shouldAutoExecute) await runAction(result.action!, result);
    } catch (error: any) {
      if (requestSequenceRef.current === requestId) {
        setIsProcessing(false);
        setErrorMessage(error?.message || 'No pude procesar la solicitud.');
      }
    }
  }

  async function handleTranscriptResult(rawText: string): Promise<void> {
    await handleFlowDictation({
      capture, flowApi, isComposerOpen, onClose, rawText, resetResult,
      runFlowAnalysis, setAnalysis, setErrorMessage, setExecutionState,
      setInputText, setIsComposerOpen, setIsProcessing, setProcessingMode,
    });
  }

  async function handleManualTextSubmit(): Promise<void> {
    if (!inputText.trim() || isProcessing || executionState.status === 'running') return;
    const submittedText = inputText;
    setInputText('');
    await runFlowAnalysis(submittedText);
  }

  return {
    action, analysis, canExecuteAction, errorMessage, executionState,
    handleManualTextSubmit, handleTranscriptResult, inputText, isComposerOpen,
    isProcessing, panelLabel, processingMode, resetResult, runAction,
    setErrorMessage, setInputText, setIsComposerOpen, setIsProcessing, showPanel,
    textareaRef,
  };
}
