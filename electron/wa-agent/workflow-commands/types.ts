import type { WorkflowHubService } from '../../workflow-hub-service';
import type { WorkspaceAutomationService } from '../../workspace-automation-service';

export interface WorkflowCommandContext {
  senderNumber: string;
  args: string[];
  workflowHubService: WorkflowHubService | null;
  workspaceAutomationService: WorkspaceAutomationService | null;
}

export function requireWorkflowHubService(service: WorkflowHubService | null): WorkflowHubService {
  if (!service) {
    throw new Error('El workflow hub todavia no esta disponible.');
  }
  return service;
}

export function requireWorkspaceAutomationConfigured(
  service: WorkspaceAutomationService | null,
  capabilityLabel: string,
): string | null {
  if (service?.isConfigured()) return null;
  return `Primero necesito una API key activa de Gemini para ${capabilityLabel}.`;
}
