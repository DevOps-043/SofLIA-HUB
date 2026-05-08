import type { MeetingContextPack, MeetingTypeDefinition } from '../meeting-context-pack';
import type { ExtractMeetingAssetInput } from './internal-types';
import { buildMeetingInput, buildPrudenceBlock, buildStrategyBlock } from './extraction-prompt-blocks';

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
