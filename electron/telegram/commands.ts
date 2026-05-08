import { buildNodesMessage, buildOpsStatusMessage, buildRunsMessage, buildTelegramHelpMessage, buildWorkflowCatalogMessage, formatCaseMessage } from './messages';
import type { TelegramRuntimeContext } from './types';
import type { WorkflowId } from '../workflow-hub/types';

export async function handleIncomingTelegramCommand(
  context: TelegramRuntimeContext,
  chatId: string,
  text: string,
): Promise<void> {
  const normalized = text.trim();
  const lowered = normalized.toLowerCase();
  const send = (message: string) => context.sendMessage(chatId, message);

  if (lowered === '/start' || lowered === '/help') return void await send(buildTelegramHelpMessage());
  if (lowered === '/agentes') {
    return void await send(['Agentes operativos disponibles:', '- correo -> /correo triage [query]', '- agenda -> /agenda brief [YYYY-MM-DD]', '- ops -> /ops status | /ops runs', '- nodes -> /nodes | /node test NODE_ID'].join('\n'));
  }
  if (lowered === '/status' || lowered === '/ops status') return void await send(await buildOpsStatusMessage(context));
  if (lowered === '/runs' || lowered === '/ops runs') return void await send(await buildRunsMessage(context));
  if (lowered === '/flujos') return void await send(await buildWorkflowCatalogMessage(context));
  if (lowered.startsWith('/correo triage')) return executeWorkflow(context, chatId, 'correo', {
    preset: 'custom',
    query: normalized.replace(/^\/correo\s+triage/i, '').trim() || 'in:inbox newer_than:7d',
  });
  if (lowered.startsWith('/agenda brief')) return executeWorkflow(context, chatId, 'agenda', {
    targetDate: normalized.replace(/^\/agenda\s+brief/i, '').trim() || undefined,
  });
  if (lowered.startsWith('/approve ')) return decideCase(context, chatId, normalized, 'approve');
  if (lowered.startsWith('/reject ')) return decideCase(context, chatId, normalized, 'reject');
  if (lowered === '/nodes') return void await send(await buildNodesMessage(context));
  if (lowered.startsWith('/node test ')) return testNode(context, chatId, normalized);
  await send(buildTelegramHelpMessage());
}

async function executeWorkflow(
  context: TelegramRuntimeContext,
  chatId: string,
  workflowId: WorkflowId,
  input: Record<string, any>,
): Promise<void> {
  const detail = await context.deps!.workflowHubService.executeWorkflow({
    workflowId,
    requestedBy: `telegram:${chatId}`,
    input,
  });
  await context.sendMessage(chatId, formatCaseMessage(detail));
}

async function decideCase(
  context: TelegramRuntimeContext,
  chatId: string,
  text: string,
  action: 'approve' | 'reject',
): Promise<void> {
  const caseId = text.replace(action === 'approve' ? /^\/approve\s+/i : /^\/reject\s+/i, '').trim();
  const detail = action === 'approve'
    ? await context.deps!.workflowHubService.approveCase({ caseId, decidedBy: `telegram:${chatId}`, scope: 'case' })
    : await context.deps!.workflowHubService.rejectCase({ caseId, decidedBy: `telegram:${chatId}`, scope: 'case' });
  await context.sendMessage(chatId, formatCaseMessage(detail));
}

async function testNode(context: TelegramRuntimeContext, chatId: string, text: string): Promise<void> {
  const nodeId = text.replace(/^\/node\s+test\s+/i, '').trim();
  const result = await context.deps!.remoteNodeService.testNode(nodeId);
  await context.sendMessage(chatId, [
    `Nodo ${nodeId}:`,
    `success=${result.success ? 'si' : 'no'}`,
    result.health?.error ? `error=${result.health.error}` : 'health=ok',
  ].join('\n'));
}
