import { formatWorkflowCaseResponse } from '../workflow-formatters';
import {
  requireWorkflowHubService,
  requireWorkspaceAutomationConfigured,
  type WorkflowCommandContext,
} from './types';

export async function handleDriveProjectCommand(context: WorkflowCommandContext): Promise<string> {
  const workflowHub = requireWorkflowHubService(context.workflowHubService);
  const parts = context.args.join(' ').trim().split('|').map((item) => item.trim());
  const projectName = parts[0] || '';
  const parentFolderId = parts[1] || '';
  const gchatSpace = parts[2] || '';
  const folderPreset = parts[3] || '';
  if (!projectName) {
    return 'Uso: /driveproyecto Nombre del proyecto | carpetaPadre opcional | espacioChat opcional | plantilla opcional';
  }

  const detail = await workflowHub.executeWorkflow({
    workflowId: 'drive',
    requestedBy: `whatsapp:${context.senderNumber}`,
    input: {
      projectName,
      parentFolderId: parentFolderId || undefined,
      gchatSpace: gchatSpace || undefined,
      folderPreset: folderPreset || undefined,
    },
  });
  return formatWorkflowCaseResponse(detail, 'Listo. Deje preparado el espacio base de Drive.');
}

export async function handleTeamUpdateCommand(context: WorkflowCommandContext): Promise<string> {
  const missingConfig = requireWorkspaceAutomationConfigured(context.workspaceAutomationService, 'redactar la actualizacion');
  if (missingConfig) return missingConfig;

  const workflowHub = requireWorkflowHubService(context.workflowHubService);
  const parts = context.args.join(' ').trim().split('|').map((item) => item.trim());
  const spaceName = parts[0] || '';
  const updateContext = parts[1] || '';
  const tone = parts[2] || '';
  if (!spaceName || !updateContext) {
    return 'Uso: /chatdirectivo SPACE | contexto | tono opcional';
  }

  const detail = await workflowHub.executeWorkflow({
    workflowId: 'actualizacion_equipo',
    requestedBy: `whatsapp:${context.senderNumber}`,
    input: { spaceName, context: updateContext, tone: tone || undefined },
  });
  return formatWorkflowCaseResponse(detail, 'Listo. Deje lista la actualizacion ejecutiva para Google Chat.');
}

export async function handleComputerWorkflowCommand(context: WorkflowCommandContext): Promise<string> {
  const missingConfig = requireWorkspaceAutomationConfigured(context.workspaceAutomationService, 'preparar la accion');
  if (missingConfig) return missingConfig;

  const workflowHub = requireWorkflowHubService(context.workflowHubService);
  const objective = context.args.join(' ').trim();
  if (!objective) {
    return 'Uso: /computadora describe la accion que quieres preparar';
  }

  const detail = await workflowHub.executeWorkflow({
    workflowId: 'pc',
    requestedBy: `whatsapp:${context.senderNumber}`,
    input: { objective },
  });
  return formatWorkflowCaseResponse(detail, 'Listo. Prepare una accion para tu computadora.');
}
