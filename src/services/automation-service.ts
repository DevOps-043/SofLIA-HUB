import type {
  CreateCustomAutomationTemplateInput,
  ExecuteAutomationTemplateInput,
} from './automation/types';
import './automation/window-api';

function getAPI() {
  if (!window.automation) {
    throw new Error('Automation API no disponible. Ejecuta SofLIA dentro de Electron.');
  }
  return window.automation;
}

export function isAutomationAvailable(): boolean {
  return !!window.automation;
}

export async function listAutomationTemplates() {
  return getAPI().listTemplates();
}

export async function listAutomationRuns(limit?: number) {
  return getAPI().listRuns(limit);
}

export async function createCustomAutomationTemplate(input: CreateCustomAutomationTemplateInput) {
  return getAPI().createCustomTemplate(input);
}

export async function getAutomationRun(runId: string) {
  return getAPI().getRun(runId);
}

export async function executeAutomationTemplate(input: ExecuteAutomationTemplateInput) {
  return getAPI().executeTemplate(input);
}

export async function approveAutomationRun(input: { runId: string; decidedBy: string; comment?: string | null }) {
  return getAPI().approveRun(input);
}

export async function rejectAutomationRun(input: { runId: string; decidedBy: string; comment?: string | null }) {
  return getAPI().rejectRun(input);
}

export type {
  CreateCustomAutomationTemplateInput,
  ExecuteAutomationTemplateInput,
  WorkflowActionKind,
  WorkflowActionRecord,
  WorkflowActionStatus,
  WorkflowApprovalRecord,
  WorkflowRunRecord,
  WorkflowRunStatus,
  WorkflowTemplateDefinition,
  WorkflowTemplateId,
} from './automation/types';
