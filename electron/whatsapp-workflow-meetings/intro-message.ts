import type { MeetingRunDetail } from '../meetings/meeting-types';
import {
  buildContextLine,
  buildFocusLine,
  getMeetingExecutiveSummary,
  resolveMeetingTitle,
  resolveMeetingTypeLabel,
} from './intro-detail';
import { buildPromptPreview } from './prompt-preview';
import { truncateText } from './text-utils';

interface MeetingRunIntroMessageOptions {
  fallbackTitle?: string | null;
  busy?: boolean;
}

export function buildMeetingRunIntroMessage(detail: MeetingRunDetail, options: MeetingRunIntroMessageOptions = {}): string {
  const promptPreview = buildPromptPreview(detail);
  const lines = options.busy
    ? ['Detecte otra reunion mientras tu workflow actual sigue abierto.', 'La deje lista para que la revises despues.']
    : ['Detecte una reunion nueva y ya prepare un brief para revisarla contigo.', 'Antes de sincronizar nada, quiero que valides el enfoque.'];

  lines.push('', `Reunion: ${resolveMeetingTitle(detail, options.fallbackTitle)}`);
  lines.push(`Tipo detectado: ${resolveMeetingTypeLabel(detail)}`);
  const contextLine = buildContextLine(detail);
  const focusLine = buildFocusLine(detail);
  if (contextLine) lines.push(`Contexto: ${contextLine}`);
  if (focusLine) lines.push(`Enfoque: ${focusLine}`);
  appendPromptPreview(lines, promptPreview);

  const summary = truncateText(getMeetingExecutiveSummary(detail), 360);
  if (summary) lines.push('', `Resumen inicial: ${summary}`);
  lines.push('');
  if (options.busy) lines.push('Cuando cierres el workflow actual, revisala desde la app en Meetings.');
  else {
    lines.push('Si este encuadre si representa la reunion, responde "aprobar resumen".');
    lines.push('Si quieres revisar el detalle antes, responde "estado" o "acciones".');
    lines.push('Si no te convence, responde "rechazar" o "cancelar".');
  }
  lines.push(`Ref: ${detail.run.id}`);
  return lines.join('\n');
}

function appendPromptPreview(lines: string[], promptPreview: string[]): void {
  if (promptPreview.length === 0) return;
  lines.push('', 'Prompt operativo generado:');
  for (const line of promptPreview) lines.push(`- ${line}`);
}
