import type { MeetingContextPack } from '../meeting-context-pack';
import type { ExtractMeetingAssetInput } from './internal-types';

/** Identidad y version del prompt de clasificacion. */
export const CLASSIFICATION_PROMPT_ID = 'meeting-classification';
export const CLASSIFICATION_PROMPT_VERSION = '1.0.0';

const CLASSIFICATION_TRANSCRIPT_PREVIEW_CHARS = 6000;

export function buildClassificationPrompt(
  input: ExtractMeetingAssetInput,
  contextPack: MeetingContextPack,
): string {
  const transcriptPreview = input.sourceArtifact.normalized_text.slice(
    0,
    CLASSIFICATION_TRANSCRIPT_PREVIEW_CHARS,
  );
  const compactRegistry = contextPack.meetingTypes.map((mt) => ({
    id: mt.id,
    displayName: mt.displayName,
    purpose: mt.purpose,
    cadence: mt.cadence,
    titleKeywords: mt.titleKeywords,
    languagePatterns: mt.languagePatterns,
    structuralSignals: mt.structuralSignals,
    negativeSignals: mt.negativeSignals,
    commonConfusions: mt.commonConfusions,
    confidenceHints: mt.confidenceHints,
  }));

  return [
    'Eres el clasificador de reuniones de SofLIA. Tu UNICA tarea es determinar el tipo de reunion.',
    'NO extraigas minuta, NO resumas, NO generes tareas. Solo clasifica.',
    '',
    '### TAXONOMIA DE TIPOS DE REUNION',
    JSON.stringify(compactRegistry, null, 2),
    '',
    '### REGLAS DE CLASIFICACION',
    '- Evalua senales positivas y negativas por tipo.',
    '- Genera un tipo sugerido (suggestedType) y hasta 3 alternativos.',
    `- Si confidence < ${contextPack.fallbackThreshold.toFixed(2)}, usa "fallback_general_operational".`,
    `- Si confidence esta entre ${contextPack.fallbackThreshold.toFixed(2)} y ${contextPack.reducedAggressivenessUpper.toFixed(2)}, marca como confianza media.`,
    '- Sube confianza cuando varias senales convergen: titulo + estructura + lenguaje.',
    '- Baja confianza si hay senales negativas o confusion con otros tipos.',
    '- No inventes datos; si no hay senales claras, usa fallback.',
    '',
    '### INPUT',
    JSON.stringify(
      {
        title: input.meetingTitle || null,
        meetingTypeHint: input.meetingType || null,
        sourceType: input.sourceArtifact.source_type,
        transcriptPreview,
      },
      null,
      2,
    ),
    '',
    '### FORMATO DE RESPUESTA (JSON estricto)',
    JSON.stringify(
      {
        suggestedType: 'id_del_tipo',
        alternativeTypes: [{ type: 'otro_id', confidence: 0.5, reason: 'razon' }],
        confidence: 0.85,
        reason: 'Explicacion de por que este tipo',
        relevantSignals: ['titulo:keyword', 'lenguaje:pattern', 'estructura:signal'],
        detectedContext: {
          project: 'nombre_proyecto_o_null',
          team: 'nombre_equipo_o_null',
          meetingObjective: ['objetivo1', 'objetivo2'],
        },
      },
      null,
      2,
    ),
    '',
    'Devuelve SOLO JSON valido, sin markdown ni texto adicional.',
  ].join('\n');
}
