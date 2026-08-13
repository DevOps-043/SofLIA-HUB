import type { MeetingContextPack, MeetingTypeDefinition } from '../meeting-context-pack';
import type { ExtractMeetingAssetInput } from './internal-types';
import { buildMeetingInput, buildPrudenceBlock, buildStrategyBlock } from './extraction-prompt-blocks';

/**
 * Identidad y version del prompt de extraccion.
 * REGLA: cualquier cambio al contenido del prompt exige subir PROMPT_VERSION.
 */
export const EXTRACTION_PROMPT_ID = 'meeting-extraction';
export const EXTRACTION_PROMPT_VERSION = '1.1.0';

export function buildExtractionPrompt(
  input: ExtractMeetingAssetInput,
  contextPack: MeetingContextPack,
  typeDefinition: MeetingTypeDefinition,
  resolvedType: string,
  resolvedConfidence: number,
  classificationReason: string,
  relevantSignals: string[],
  alternativeTypes: unknown[],
  detectedContext: Record<string, unknown>,
): string {
  const isLowConfidence = resolvedConfidence < contextPack.reducedAggressivenessUpper;

  return [
    'Eres el motor de extraccion de Meeting Intelligence de SofLIA.',
    'La reunion YA fue clasificada. Tu tarea es EXTRAER la minuta operativa usando la estrategia especifica de este tipo.',
    'NO reclasifiques. Usa el tipo y estrategia que te doy.',
    '',
    ...buildStrategyBlock(typeDefinition, resolvedType, resolvedConfidence, classificationReason),
    ...buildPrudenceBlock(isLowConfidence),
    '',
    '### REGLAS DE EXTRACCION',
    contextPack.extractionRulesRaw,
    '',
    '### SCHEMA DE SALIDA',
    contextPack.outputSchemaRaw,
    '',
    '### REGLAS DURAS',
    '- No inventes datos. Si no hay evidencia, deja el campo vacio o con confidence baja.',
    '- Separa hechos explicitos de inferencias.',
    '- Toda accion sensible requiere aprobacion humana (requiresHumanApproval: true).',
    '- Cada tarea debe tener verbo accionable.',
    '- No confundas "tema conversado" con "tarea aprobada".',
    '- No trates hipotesis como decision tomada.',
    '- Incluye evidence (citas cortas del texto) en decisions, tasks, risks.',
    '- Cuando cites evidencia, agrega si puedes un localizador aproximado con el formato "[linea N]" o "[minuto MM:SS]" al inicio de la cita. Si no puedes ubicarla, omite el localizador (no lo inventes).',
    '- Devuelve SOLO JSON valido, sin markdown ni texto adicional.',
    '',
    '### CLASIFICACION YA RESUELTA (no cambiar)',
    JSON.stringify(
      {
        meetingType: {
          suggestedType: resolvedType,
          alternativeTypes,
          confidence: resolvedConfidence,
          reason: classificationReason,
        },
        detectedContext: {
          ...detectedContext,
          relevantSignals,
        },
        analysisStrategy: {
          strategyId: resolvedType,
          strategyName: typeDefinition.displayName,
          whyThisStrategy: `Estrategia seleccionada por clasificacion como ${typeDefinition.displayName}: ${classificationReason}`,
          extractionFocus: typeDefinition.extractionFocus,
        },
      },
      null,
      2,
    ),
    '',
    '### TRANSCRIPCION / TEXTO FUENTE',
    JSON.stringify(buildMeetingInput(input), null, 2),
  ].join('\n');
}
