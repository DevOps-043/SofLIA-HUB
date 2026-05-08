import type { MeetingWorkflowService } from '../meetings/meeting-workflow-service';
import { shouldCloseWorkflow } from './formatters';
import { buildMeetingRunIntroMessage } from './intro-message';

export function buildStartMessage(): string {
  return [
    'Workflow de reuniones iniciado.',
    '',
    'Enviame una de estas dos cosas:',
    '1. Notas de reunion en texto.',
    '2. Un link o ID de Google Drive con la transcripcion o notas.',
    '',
    'Luego podras responder: "estado", "aprobar resumen", "aprobar acciones", "sincronizar", "rechazar" o "cancelar".',
  ].join('\n');
}

export async function buildExistingRunIntroMessage(
  workflowService: MeetingWorkflowService,
  runId: string | null,
): Promise<string> {
  if (!runId) return 'No pude preparar el resumen inicial de la reunion.';
  try {
    return buildMeetingRunIntroMessage(await workflowService.getRunDetail(runId));
  } catch (error) {
    console.warn('[MeetingWhatsAppWorkflow] Could not build intro message for existing run:', error);
    return [
      'Detecte una reunion nueva y ya cargue la transcripcion.',
      `Ref: ${runId}`,
      'Responde "estado", "acciones", "aprobar resumen", "rechazar" o "cancelar".',
    ].join('\n');
  }
}

export async function buildUnknownInstructionMessage(
  workflowService: MeetingWorkflowService,
  runId: string | null,
): Promise<string> {
  const help = 'No reconoci la instruccion. Usa: "estado", "acciones", "aprobar resumen", "aprobar acciones", "aprobar accion N", "editar accion N ...", "sincronizar", "rechazar" o "cancelar".';
  if (!runId) return help;

  const detail = await workflowService.getRunDetail(runId);
  if (shouldCloseWorkflow(detail)) {
    return 'Este workflow de reuniones ya termino. Lo cierro para devolverte el chat normal. Si quieres revisar otra reunion, usa /reunion.';
  }
  return help;
}
