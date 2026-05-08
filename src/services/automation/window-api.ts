import type {
  CreateCustomAutomationTemplateInput,
  ExecuteAutomationTemplateInput,
  WorkflowRunRecord,
  WorkflowTemplateDefinition,
} from './types';

declare global {
  interface Window {
    automation?: {
      listTemplates: () => Promise<{ success: boolean; templates?: WorkflowTemplateDefinition[]; error?: string }>;
      listRuns: (limit?: number) => Promise<{ success: boolean; runs?: WorkflowRunRecord[]; error?: string }>;
      createCustomTemplate: (input: CreateCustomAutomationTemplateInput) => Promise<{ success: boolean; template?: WorkflowTemplateDefinition; error?: string }>;
      getRun: (runId: string) => Promise<{ success: boolean; run?: WorkflowRunRecord; error?: string }>;
      executeTemplate: (input: ExecuteAutomationTemplateInput) => Promise<{ success: boolean; run?: WorkflowRunRecord; error?: string }>;
      approveRun: (input: { runId: string; decidedBy: string; comment?: string | null }) => Promise<{ success: boolean; run?: WorkflowRunRecord; error?: string }>;
      rejectRun: (input: { runId: string; decidedBy: string; comment?: string | null }) => Promise<{ success: boolean; run?: WorkflowRunRecord; error?: string }>;
    };
  }
}

export {};
