import { executeFlowAction, type FlowAction, type FlowAnalysisResult } from '../../services/flow-service';
import type { ExecutionState } from './types';
import type { FlowCaptureLifecycle } from './useFlowCaptureLifecycle';

interface RunFlowActionOptions {
  capture: FlowCaptureLifecycle;
  currentAnalysis: FlowAnalysisResult | null;
  executionState: ExecutionState;
  flowAction: FlowAction;
  onClose: () => void;
  onSendToChat: (message: string) => void;
  setExecutionState: (state: ExecutionState) => void;
}

export async function runFlowAction(options: RunFlowActionOptions): Promise<void> {
  const { capture, currentAnalysis, executionState, flowAction, onClose, onSendToChat, setExecutionState } = options;
  if (!currentAnalysis || executionState.status === 'running') return;

  if (flowAction.type === 'send_to_chat') {
    onSendToChat(currentAnalysis.chatPrompt || currentAnalysis.response || currentAnalysis.transcript);
    return;
  }

  if (flowAction.type === 'desktop_automation') {
    capture.teardownCapture(false);
    onClose();
    await new Promise<void>((resolve) => window.setTimeout(resolve, 180));
  }

  setExecutionState({ status: 'running', message: flowAction.description || 'Ejecutando accion...' });
  try {
    const result = await executeFlowAction(flowAction);
    setExecutionState({ status: result.success ? 'success' : 'error', message: result.message, detail: result.detail });
  } catch (error: any) {
    setExecutionState({ status: 'error', message: 'No pude completar la accion.', detail: error?.message || String(error) });
  }
}
