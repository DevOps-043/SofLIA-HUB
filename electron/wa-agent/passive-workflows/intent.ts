import { normalizeForIntent } from './normalize';
import { extractPassiveSchedule } from './schedule';
import type { PassiveWorkflowId, PassiveWorkflowIntent } from './types';

const ACTION_INTENT_REGEX = /\b(recuerdame|avisa|avisame|dame|enviame|mandame|prende|apaga|resume|resumeme|revisa|haz|ejecuta|prepara|busca|traeme|trae)\b/;

export function parsePassiveWorkflowIntent(text: string): PassiveWorkflowIntent | null {
  const schedule = extractPassiveSchedule(text);
  if (!schedule) return null;

  const normalized = normalizeForIntent(text);
  if (!ACTION_INTENT_REGEX.test(normalized)) return null;

  const workflowId = detectPassiveWorkflowId(text);
  const compact = text.trim().replace(/\s+/g, ' ');
  const name = workflowId === 'correo'
    ? 'Resumen de correos'
    : workflowId === 'agenda'
      ? 'Briefing de agenda'
      : workflowId === 'reuniones'
        ? 'Seguimiento de reuniones'
        : compact.slice(0, 72) || 'Rutina pasiva';

  return {
    workflowId,
    name,
    description: workflowId
      ? `Workflow pasivo de ${workflowId} creado desde WhatsApp.`
      : 'Rutina pasiva libre creada desde WhatsApp.',
    prompt: compact,
    cronExpression: schedule.cronExpression,
    scheduleLabel: schedule.scheduleLabel,
  };
}

export function detectPassiveWorkflowId(text: string): PassiveWorkflowId | undefined {
  const normalized = normalizeForIntent(text);
  if (/\b(correo|correos|gmail|bandeja|inbox)\b/.test(normalized)) return 'correo';
  if (/\b(agenda|calendario|calendar|briefing)\b/.test(normalized)) return 'agenda';
  if (/\b(reunion|reuniones|meet|meeting)\b/.test(normalized)) return 'reuniones';
  return undefined;
}
