import type { TelegramRuntimeContext } from './types';

export function buildTelegramHelpMessage(): string {
  return [
    'Comandos disponibles:',
    '/agentes',
    '/ops status',
    '/ops runs',
    '/flujos',
    '/correo triage [query]',
    '/agenda brief [YYYY-MM-DD]',
    '/approve CASE_ID',
    '/reject CASE_ID',
    '/nodes',
    '/node test NODE_ID',
  ].join('\n');
}

export async function buildOpsStatusMessage(context: TelegramRuntimeContext): Promise<string> {
  const status = {
    enabled: context.state.config.enabled,
    polling: context.isPolling(),
    bot: context.state.botInfo,
    last_poll_at: context.state.lastPollAt,
    recent_chats: context.state.recentChats,
  };
  const overview = await context.deps!.workflowHubService.getOverview();
  const pending = overview.cases.filter((run) => run.normalizedStatus === 'pending_approval').length;
  return [
    'Estado operativo SofLIA:',
    `Telegram: ${status.enabled ? 'habilitado' : 'deshabilitado'} / ${status.polling ? 'polling activo' : 'polling detenido'}`,
    `Bot: ${status.bot?.username || status.bot?.first_name || 'sin-bot'}`,
    `Ultimo poll: ${status.last_poll_at || 'n/a'}`,
    `Casos recientes: ${overview.cases.length}`,
    `Pendientes de aprobacion: ${pending}`,
    `Chats recientes: ${status.recent_chats?.length || 0}`,
  ].join('\n');
}

export async function buildRunsMessage(context: TelegramRuntimeContext): Promise<string> {
  const overview = await context.deps!.workflowHubService.getOverview();
  const cases = overview.cases.slice(0, 5);
  if (cases.length === 0) return 'No hay casos registrados.';
  return ['Casos recientes:', ...cases.map((run) => `- ${run.id} | ${run.nativeStatus} | ${run.title}`), '', 'Comandos:', '/approve CASE_ID', '/reject CASE_ID'].join('\n');
}

export async function buildWorkflowCatalogMessage(context: TelegramRuntimeContext): Promise<string> {
  const overview = await context.deps!.workflowHubService.getOverview();
  const countByWorkflow = overview.variants.reduce<Record<string, number>>((acc, variant) => {
    acc[variant.workflowId] = (acc[variant.workflowId] || 0) + 1;
    return acc;
  }, {});
  return [
    'Workflows disponibles:',
    ...overview.workflows.map((workflow) => `- ${workflow.name} | variantes=${countByWorkflow[workflow.id] || 0} | ${workflow.summary}`),
    '',
    'Las variantes nuevas se guardan desde la app. La creacion libre por chat ya no esta habilitada.',
  ].join('\n');
}

export async function buildNodesMessage(context: TelegramRuntimeContext): Promise<string> {
  const host = await context.deps!.remoteNodeService.getHostStatus();
  const nodes = await context.deps!.remoteNodeService.listNodes();
  return [
    'Estado de nodos:',
    `Host remoto: ${host.running ? 'activo' : 'inactivo'} en ${host.local_url}`,
    `Nodo local: ${host.node_name}`,
    `Nodos registrados: ${nodes.length}`,
    ...nodes.slice(0, 8).map((node) => `- ${node.id} | ${node.name} | ${node.baseUrl} | ${node.lastHealthAt ? 'ok' : 'sin-health'}`),
  ].join('\n');
}

export function formatCaseMessage(detail: Record<string, any>): string {
  const actions = Array.isArray(detail.actionsDetail) ? detail.actionsDetail : [];
  return [
    `${detail.title}`,
    `Caso: ${detail.id}`,
    `Estado: ${detail.nativeStatus}`,
    `Resumen: ${detail.summary || 'Sin resumen.'}`,
    `Acciones: ${actions.length}`,
    ...actions.slice(0, 5).map((action: any) => `- ${action.title} | ${action.status}`),
    detail.normalizedStatus === 'pending_approval' ? 'Usa /approve CASE_ID o /reject CASE_ID' : '',
  ].filter(Boolean).join('\n');
}
