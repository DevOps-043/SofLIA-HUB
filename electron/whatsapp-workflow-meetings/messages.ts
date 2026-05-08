import type { MeetingWorkflowService } from '../meetings/meeting-workflow-service';
import { shouldCloseWorkflow } from './formatters';
import { buildMeetingRunIntroMessage } from './intro-message';

export const MEETING_WORKFLOW_START_MESSAGE = [
  'Workflow de reuniones iniciado.',
  '',
  'Enviame una de estas dos cosas:',
  '1. Notas de reunion en texto.',
  '2. Un link o ID de Google Drive con la transcripcion o notas.',
  '',
  'Luego podras responder: "estado", "aprobar resumen", "aprobar acciones", "sincronizar", "rechazar" o "cancelar".',
].join('\n');

export const MEETING_UNKNOWN_INSTRUCTION =
  'No reconoci la instruccion. Usa: "estado", "acciones", "aprobar resumen", "aprobar acciones", "aprobar accion N", "editar accion N ...", "sincronizar", "rechazar" o "cancelar".';

export const MEETING_INACTIVITY_CANCEL_MESSAGE =
  'Workflow de reuniones cancelado por inactividad despues de 5 minutos. Si quieres retomarlo, inicia /reunion de nuevo.';

export function buildApprovalMessage(title: string, status: string, shouldClose: boolean): string {
  const done = shouldClose ? '\n\nWorkflow de reuniones finalizado. Ya puedes volver a preguntarme lo que necesites.' : '';
  return `${title}\n\n${status}${done}`;
}

export async function buildExistingRunIntroMessage(workflowService: MeetingWorkflowService, runId: string): Promise<string> {
  try {
    const detail = await workflowService.getRunDetail(runId);
    return buildMeetingRunIntroMessage(detail);
  } catch (error) {
    console.warn('[MeetingWhatsAppWorkflow] Could not build intro message for existing run:', error);
    return [
      'Detecte una reunion nueva y ya cargue la transcripcion.',
      `Ref: ${runId}`,
      'Responde "estado", "acciones", "aprobar resumen", "rechazar" o "cancelar".',
    ].join('\n');
  }
}

export async function buildUnknownInstructionMessage(workflowService: MeetingWorkflowService, runId: string | null): Promise<string> {
  if (!runId) return MEETING_UNKNOWN_INSTRUCTION;
  const detail = await workflowService.getRunDetail(runId);
  if (shouldCloseWorkflow(detail)) {
    return 'Este workflow de reuniones ya termino. Lo cierro para devolverte el chat normal. Si quieres revisar otra reunion, usa /reunion.';
  }
  return MEETING_UNKNOWN_INSTRUCTION;
}
