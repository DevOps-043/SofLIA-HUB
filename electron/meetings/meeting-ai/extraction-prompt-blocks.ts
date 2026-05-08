import type { MeetingTypeDefinition } from '../meeting-context-pack';
import { MAX_SOURCE_TEXT_CHARS } from './constants';
import type { ExtractMeetingAssetInput } from './internal-types';
import { describeSource, extractDateTimeHint, extractParticipants, getLines } from './text-helpers';

export function buildMeetingInput(input: ExtractMeetingAssetInput): Record<string, unknown> {
  return {
    meetingId: input.meetingRunId,
    title: input.meetingTitle || null,
    description: describeSource(input.sourceArtifact),
    participants: extractParticipants(getLines(input.sourceArtifact.normalized_text)).map((p) => ({
      name: p.display_name,
      role: null,
      email: p.email || null,
    })),
    dateTime: extractDateTimeHint(input.sourceArtifact),
    transcriptRaw: input.sourceArtifact.normalized_text.slice(0, MAX_SOURCE_TEXT_CHARS),
  };
}

export function buildStrategyBlock(
  typeDefinition: MeetingTypeDefinition,
  resolvedType: string,
  resolvedConfidence: number,
  classificationReason: string,
): string[] {
  return [
    `## TIPO DE REUNION CLASIFICADO: ${typeDefinition.displayName} (${resolvedType})`,
    `Confianza de clasificacion: ${resolvedConfidence.toFixed(2)}`,
    `Razon: ${classificationReason}`,
    '',
    '### PROPOSITO DE ESTE TIPO',
    typeDefinition.purpose,
    '',
    '### ESTRUCTURA ESPERADA',
    'Esta reunion deberia tener estas secciones:',
    ...typeDefinition.expectedStructure.map((section) => `- ${section}`),
    '',
    '### FOCO DE EXTRACCION (QUE BUSCAR)',
    'Prioriza extraer esta informacion del texto:',
    ...typeDefinition.extractionFocus.map((focus) => `- ${focus}`),
    '',
    '### OUTPUTS DE ALTO VALOR',
    'Lo mas valioso que puedes producir para este tipo de reunion:',
    ...typeDefinition.highValueOutputs.map((output) => `- ${output}`),
    '',
    '### CONTEXTO DE DESTINO',
    `Destino por defecto: ${typeDefinition.defaultDestination}`,
    typeDefinition.routingNotes ? `Nota de routing: ${typeDefinition.routingNotes}` : '',
    '',
    '### CONFUSIONES COMUNES',
    typeDefinition.commonConfusions.length > 0
      ? `Este tipo se confunde frecuentemente con: ${typeDefinition.commonConfusions.join(', ')}. Asegurate de que las senales correspondan.`
      : 'Sin confusiones comunes registradas.',
  ];
}

export function buildPrudenceBlock(isLowConfidence: boolean): string[] {
  if (!isLowConfidence) return [];

  return [
    '',
    '### MODO PRUDENTE (confianza media-baja)',
    '- Reduce la agresividad de recomendaciones.',
    '- Solo incluye tareas con evidencia clara (confidence >= 0.68).',
    '- No sugieras owners sin senales fuertes.',
    '- No inventes fechas limite.',
    '- Limita tareas a las mas claras (max 4).',
    '- Prefiere destino "None" si no hay senales claras de routing.',
  ];
}
