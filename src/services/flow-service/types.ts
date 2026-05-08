export type FlowIntent =
  | 'answer'
  | 'rewrite'
  | 'instruction'
  | 'email'
  | 'automation'
  | 'clarify';

export type FlowMode =
  | 'answer'
  | 'draft'
  | 'action';

export type FlowActionType =
  | 'none'
  | 'open_application'
  | 'open_url'
  | 'send_email'
  | 'desktop_automation'
  | 'send_to_chat';

export interface FlowAction {
  type: FlowActionType;
  label: string;
  description: string;
  target?: string;
  url?: string;
  task?: string;
  to?: string;
  subject?: string;
  body?: string;
  attachmentPaths?: string[];
  autoExecute: boolean;
  requiresConfirmation: boolean;
}

export interface FlowAnalysisResult {
  intent: FlowIntent;
  mode: FlowMode;
  title: string;
  lead: string;
  response: string;
  confidence: number;
  transcript: string;
  missing: string[];
  chatPrompt: string;
  action: FlowAction | null;
}

export interface FlowExecutionResult {
  success: boolean;
  message: string;
  detail?: string;
  raw?: unknown;
}

export interface RawFlowAction {
  type?: unknown;
  label?: unknown;
  description?: unknown;
  target?: unknown;
  url?: unknown;
  task?: unknown;
  to?: unknown;
  subject?: unknown;
  body?: unknown;
  attachmentPaths?: unknown;
  autoExecute?: unknown;
  requiresConfirmation?: unknown;
}

export interface RawFlowAnalysis {
  intent?: unknown;
  mode?: unknown;
  title?: unknown;
  lead?: unknown;
  response?: unknown;
  confidence?: unknown;
  missing?: unknown;
  chatPrompt?: unknown;
  action?: RawFlowAction | null;
}

export type DesktopAutomationExecutionPlan = {
  task: string;
  backend: 'auto' | 'browser' | 'desktop' | 'uia';
  startUrl?: string;
  preOpenTarget?: string;
};

export type ComputerUseBridge = {
  openApplication?: (target: string) => Promise<{ success?: boolean; message?: string; error?: string }>;
};
