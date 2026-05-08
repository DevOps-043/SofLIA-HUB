import type { WorkflowHubService } from '../../workflow-hub-service';
import {
  formatPendingCases,
  formatWorkflowCatalogList,
  formatWorkflowCaseResponse,
  normalizeWorkflowCaseId,
} from '../workflow-formatters';
import { requireWorkflowHubService, type WorkflowCommandContext } from './types';

export async function handleWorkflowCatalogCommand(
  workflowHubService: WorkflowHubService | null,
): Promise<string> {
  const workflowHub = requireWorkflowHubService(workflowHubService);
  return formatWorkflowCatalogList(await workflowHub.getOverview());
}

export async function handlePendingWorkflowCasesCommand(
  workflowHubService: WorkflowHubService | null,
): Promise<string> {
  const workflowHub = requireWorkflowHubService(workflowHubService);
  return formatPendingCases(await workflowHub.getOverview());
}

export async function handleApproveWorkflowCaseCommand(context: WorkflowCommandContext): Promise<string> {
  const workflowHub = requireWorkflowHubService(context.workflowHubService);
  const caseId = context.args[0]?.trim();
  if (!caseId) {
    return 'Uso: /aprobar CASE_ID comentario opcional';
  }

  const detail = await workflowHub.approveCase({
    caseId: normalizeWorkflowCaseId(caseId),
    decidedBy: `whatsapp:${context.senderNumber}`,
    scope: 'case',
    comment: context.args.slice(1).join(' ').trim() || null,
  });
  return formatWorkflowCaseResponse(detail, 'Caso autorizado.');
}

export async function handleRejectWorkflowCaseCommand(context: WorkflowCommandContext): Promise<string> {
  const workflowHub = requireWorkflowHubService(context.workflowHubService);
  const caseId = context.args[0]?.trim();
  if (!caseId) {
    return 'Uso: /rechazar CASE_ID comentario opcional';
  }

  const detail = await workflowHub.rejectCase({
    caseId: normalizeWorkflowCaseId(caseId),
    decidedBy: `whatsapp:${context.senderNumber}`,
    scope: 'case',
    comment: context.args.slice(1).join(' ').trim() || null,
  });
  return formatWorkflowCaseResponse(detail, 'Caso rechazado.');
}
