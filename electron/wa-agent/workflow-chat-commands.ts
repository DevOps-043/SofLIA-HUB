/**
 * Handlers de comandos WhatsApp que ejecutan capacidades del Workflow Hub.
 *
 * Cada funcion cubre un comando de negocio y recibe sus dependencias de forma
 * explicita para que el dispatcher principal siga siendo pequeno y testeable.
 */

import type { WorkflowHubService } from '../workflow-hub-service';
import type { WorkspaceAutomationService } from '../workspace-automation-service';
import { resolveAutomationBriefDate, resolveAutomationMailQuery } from './automation-resolvers';
import {
  formatPendingCases,
  formatWorkflowCatalogList,
  formatWorkflowCaseResponse,
  normalizeWorkflowCaseId,
} from './workflow-formatters';

interface WorkflowCommandContext {
  senderNumber: string;
  args: string[];
  workflowHubService: WorkflowHubService | null;
  workspaceAutomationService: WorkspaceAutomationService | null;
}

export async function handleMeetingWorkflowCommand(context: WorkflowCommandContext): Promise<string> {
  const workflowHub = requireWorkflowHubService(context.workflowHubService);
  const raw = context.args.join(' ').trim();
  if (!raw) {
    return 'Uso: /reunion pega notas directamente, o /reunion prep 2026-03-22, o /reunion drive | LINK | titulo opcional';
  }

  if (/^prep(\s|$)/i.test(raw)) {
    const targetDate = resolveAutomationBriefDate([raw.replace(/^prep\s*/i, '').trim()].filter(Boolean));
    const detail = await workflowHub.executeWorkflow({
      workflowId: 'reuniones',
      requestedBy: `whatsapp:${context.senderNumber}`,
      input: { mode: 'prep', targetDate },
    });
    return formatWorkflowCaseResponse(detail, 'Listo. Prepare la reunion.');
  }

  if (/^drive(\s*\||\s+)/i.test(raw)) {
    const rest = raw.replace(/^drive/i, '').trim().replace(/^\|/, '').trim();
    const parts = rest.split('|').map((item) => item.trim()).filter(Boolean);
    const driveRef = parts[0] || '';
    const meetingTitle = parts[1] || '';
    if (!driveRef) {
      return 'Uso: /reunion drive | LINK_O_ID | titulo opcional';
    }
    const detail = await workflowHub.executeWorkflow({
      workflowId: 'reuniones',
      requestedBy: `whatsapp:${context.senderNumber}`,
      input: { mode: 'drive', driveRef, meetingTitle },
    });
    return formatWorkflowCaseResponse(detail, 'Listo. Cree el caso de reunion desde Drive.');
  }

  if (/^auto(\s|$)/i.test(raw)) {
    return 'La deteccion automatica de reuniones corre en segundo plano. Usa /flujos para revisar capacidades y casos detectados.';
  }

  const detail = await workflowHub.executeWorkflow({
    workflowId: 'reuniones',
    requestedBy: `whatsapp:${context.senderNumber}`,
    input: { mode: 'manual', manualText: raw },
  });
  return formatWorkflowCaseResponse(detail, 'Listo. Cree el caso de reunion.');
}

export async function handleMailReviewCommand(context: WorkflowCommandContext): Promise<string> {
  if (!context.workspaceAutomationService?.isConfigured()) {
    return 'Primero necesito una API key activa de Gemini para revisar correos.';
  }
  const workflowHub = requireWorkflowHubService(context.workflowHubService);
  const query = resolveAutomationMailQuery(context.args);
  const detail = await workflowHub.executeWorkflow({
    workflowId: 'correo',
    requestedBy: `whatsapp:${context.senderNumber}`,
    input: {
      preset: 'custom',
      query,
      maxResults: 5,
      removeFromInbox: true,
    },
  });
  return formatWorkflowCaseResponse(detail, 'Listo. Prepare una revision ejecutiva de correo.');
}

export async function handleAgendaCommand(context: WorkflowCommandContext): Promise<string> {
  if (!context.workspaceAutomationService?.isConfigured()) {
    return 'Primero necesito una API key activa de Gemini para preparar la agenda.';
  }
  const workflowHub = requireWorkflowHubService(context.workflowHubService);
  const targetDate = resolveAutomationBriefDate(context.args);
  const detail = await workflowHub.executeWorkflow({
    workflowId: 'agenda',
    requestedBy: `whatsapp:${context.senderNumber}`,
    input: { targetDate },
  });
  return formatWorkflowCaseResponse(detail, `Listo. Prepare tu resumen de agenda${targetDate ? ` para ${targetDate}` : ' de hoy'}.`);
}

export async function handleFollowUpCommand(context: WorkflowCommandContext): Promise<string> {
  if (!context.workspaceAutomationService?.isConfigured()) {
    return 'Primero necesito una API key activa de Gemini para redactar el seguimiento.';
  }
  const workflowHub = requireWorkflowHubService(context.workflowHubService);
  const raw = context.args.join(' ').trim();
  const parts = raw.split('|').map((item) => item.trim());
  const to = parts[0] || '';
  const topic = parts[1] || '';
  const followUpContext = parts[2] || '';
  const tone = parts[3] || '';
  const signature = parts[4] || '';
  if (!to || !topic) {
    return 'Uso: /seguimiento correo@empresa.com | tema | contexto opcional | tono opcional | firma opcional';
  }

  const detail = await workflowHub.executeWorkflow({
    workflowId: 'seguimiento',
    requestedBy: `whatsapp:${context.senderNumber}`,
    input: {
      to,
      topic,
      context: followUpContext || undefined,
      tone: tone || undefined,
      signature: signature || undefined,
    },
  });
  return formatWorkflowCaseResponse(detail, 'Listo. Deje preparado el correo de seguimiento.');
}

export async function handleMeetingPrepCommand(context: WorkflowCommandContext): Promise<string> {
  if (!context.workspaceAutomationService?.isConfigured()) {
    return 'Primero necesito una API key activa de Gemini para preparar la reunion.';
  }
  const workflowHub = requireWorkflowHubService(context.workflowHubService);
  const targetDate = resolveAutomationBriefDate(context.args);
  const detail = await workflowHub.executeWorkflow({
    workflowId: 'reuniones',
    requestedBy: `whatsapp:${context.senderNumber}`,
    input: { mode: 'prep', targetDate },
  });
  return formatWorkflowCaseResponse(detail, `Listo. Prepare tu siguiente reunion${targetDate ? ` para ${targetDate}` : ''}.`);
}

export async function handleDriveProjectCommand(context: WorkflowCommandContext): Promise<string> {
  const workflowHub = requireWorkflowHubService(context.workflowHubService);
  const raw = context.args.join(' ').trim();
  const parts = raw.split('|').map((item) => item.trim());
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
  if (!context.workspaceAutomationService?.isConfigured()) {
    return 'Primero necesito una API key activa de Gemini para redactar la actualizacion.';
  }
  const workflowHub = requireWorkflowHubService(context.workflowHubService);
  const raw = context.args.join(' ').trim();
  const parts = raw.split('|').map((item) => item.trim());
  const spaceName = parts[0] || '';
  const updateContext = parts[1] || '';
  const tone = parts[2] || '';
  if (!spaceName || !updateContext) {
    return 'Uso: /chatdirectivo SPACE | contexto | tono opcional';
  }

  const detail = await workflowHub.executeWorkflow({
    workflowId: 'actualizacion_equipo',
    requestedBy: `whatsapp:${context.senderNumber}`,
    input: {
      spaceName,
      context: updateContext,
      tone: tone || undefined,
    },
  });
  return formatWorkflowCaseResponse(detail, 'Listo. Deje lista la actualizacion ejecutiva para Google Chat.');
}

export async function handleComputerWorkflowCommand(context: WorkflowCommandContext): Promise<string> {
  if (!context.workspaceAutomationService?.isConfigured()) {
    return 'Primero necesito una API key activa de Gemini para preparar la accion.';
  }
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

export async function handleWorkflowCatalogCommand(workflowHubService: WorkflowHubService | null): Promise<string> {
  const workflowHub = requireWorkflowHubService(workflowHubService);
  return formatWorkflowCatalogList(await workflowHub.getOverview());
}

export async function handlePendingWorkflowCasesCommand(workflowHubService: WorkflowHubService | null): Promise<string> {
  const workflowHub = requireWorkflowHubService(workflowHubService);
  return formatPendingCases(await workflowHub.getOverview());
}

export async function handleApproveWorkflowCaseCommand(context: WorkflowCommandContext): Promise<string> {
  const workflowHub = requireWorkflowHubService(context.workflowHubService);
  const caseId = context.args[0]?.trim();
  if (!caseId) {
    return 'Uso: /aprobar CASE_ID comentario opcional';
  }
  const comment = context.args.slice(1).join(' ').trim() || null;
  const detail = await workflowHub.approveCase({
    caseId: normalizeWorkflowCaseId(caseId),
    decidedBy: `whatsapp:${context.senderNumber}`,
    scope: 'case',
    comment,
  });
  return formatWorkflowCaseResponse(detail, 'Caso autorizado.');
}

export async function handleRejectWorkflowCaseCommand(context: WorkflowCommandContext): Promise<string> {
  const workflowHub = requireWorkflowHubService(context.workflowHubService);
  const caseId = context.args[0]?.trim();
  if (!caseId) {
    return 'Uso: /rechazar CASE_ID comentario opcional';
  }
  const comment = context.args.slice(1).join(' ').trim() || null;
  const detail = await workflowHub.rejectCase({
    caseId: normalizeWorkflowCaseId(caseId),
    decidedBy: `whatsapp:${context.senderNumber}`,
    scope: 'case',
    comment,
  });
  return formatWorkflowCaseResponse(detail, 'Caso rechazado.');
}

function requireWorkflowHubService(service: WorkflowHubService | null): WorkflowHubService {
  if (!service) {
    throw new Error('El workflow hub todavia no esta disponible.');
  }
  return service;
}
