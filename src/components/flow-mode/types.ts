import type React from 'react';
import type {
  FlowAction,
  FlowAnalysisResult,
} from '../../services/flow-service';

export interface FlowModeProps {
  isActive: boolean;
  onClose: () => void;
  onSendToChat: (text: string) => void;
}

export type ListeningMode = 'speech' | 'audio' | null;
export type ExecutionStatus = 'idle' | 'running' | 'success' | 'error';
export type SpeechRecognitionConstructor = new () => any;

export type FlowBridge = {
  insertText?: (text: string) => Promise<{ success?: boolean; error?: string; code?: string }>;
};

export interface ExecutionState {
  status: ExecutionStatus;
  message: string;
  detail?: string;
}

export type FlowModePanelProps = {
  action: FlowAction | null;
  analysis: FlowAnalysisResult | null;
  canExecuteAction: boolean;
  errorMessage: string;
  executionState: ExecutionState;
  handleManualTextSubmit: () => Promise<void>;
  inputText: string;
  isComposerOpen: boolean;
  isListening: boolean;
  isProcessing: boolean;
  liveTranscript: string;
  panelLabel: string;
  processingMode: 'assistant' | 'dictation';
  resetResult: () => void;
  resetTranscript: () => void;
  runAction: (flowAction: FlowAction) => Promise<void>;
  setInputText: React.Dispatch<React.SetStateAction<string>>;
  showPanel: boolean;
  textareaRef: React.RefObject<HTMLTextAreaElement>;
  transcriptFinal: string;
  transcriptInterim: string;
};
