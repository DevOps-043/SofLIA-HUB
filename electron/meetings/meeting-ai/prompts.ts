/**
 * Builders de prompts para el pipeline de Meeting Intelligence.
 *
 * Funciones puras — no usan estado de instancia. Pueden testearse en
 * aislamiento pasando inputs determinísticos y verificando los strings
 * resultantes.
 *
 * Pipeline:
 *  - **Fase 1** (`buildClassificationPrompt`): identifica el tipo de reunión
 *    a partir de señales en título, lenguaje y estructura.
 *  - **Fase 2** (`buildExtractionPrompt`): con el tipo ya resuelto, extrae
 *    minuta operativa siguiendo la estrategia específica del tipo.
 */

import type { MeetingContextPack, MeetingTypeDefinition } from '../meeting-context-pack';
import { MAX_SOURCE_TEXT_CHARS } from './constants';
import type { ExtractMeetingAssetInput } from './internal-types';
import { describeSource, extractDateTimeHint, extractParticipants, getLines } from './text-helpers';

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
    '- No inventes — si no hay senales claras, usa fallback.',
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
  const transcriptFull = input.sourceArtifact.normalized_text.slice(0, MAX_SOURCE_TEXT_CHARS);
  const isLowConfidence = resolvedConfidence < contextPack.reducedAggressivenessUpper;

  const meetingInput = {
    meetingId: input.meetingRunId,
    title: input.meetingTitle || null,
    description: describeSource(input.sourceArtifact),
    participants: extractParticipants(getLines(input.sourceArtifact.normalized_text)).map((p) => ({
      name: p.display_name,
      role: null,
      email: p.email || null,
    })),
    dateTime: extractDateTimeHint(input.sourceArtifact),
    transcriptRaw: transcriptFull,
  };

  const strategyBlock = [
    `## TIPO DE REUNION CLASIFICADO: ${typeDefinition.displayName} (${resolvedType})`,
    `Confianza de clasificacion: ${resolvedConfidence.toFixed(2)}`,
    `Razon: ${classificationReason}`,
    '',
    `### PROPOSITO DE ESTE TIPO`,
    typeDefinition.purpose,
    '',
    `### ESTRUCTURA ESPERADA`,
    `Esta reunion deberia tener estas secciones:`,
    ...typeDefinition.expectedStructure.map((s) => `- ${s}`),
    '',
    `### FOCO DE EXTRACCION (QUE BUSCAR)`,
    `Prioriza extraer esta informacion del texto:`,
    ...typeDefinition.extractionFocus.map((f) => `- ${f}`),
    '',
    `### OUTPUTS DE ALTO VALOR`,
    `Lo mas valioso que puedes producir para este tipo de reunion:`,
    ...typeDefinition.highValueOutputs.map((o) => `- ${o}`),
    '',
    `### CONTEXTO DE DESTINO`,
    `Destino por defecto: ${typeDefinition.defaultDestination}`,
    typeDefinition.routingNotes ? `Nota de routing: ${typeDefinition.routingNotes}` : '',
    '',
    `### CONFUSIONES COMUNES`,
    typeDefinition.commonConfusions.length > 0
      ? `Este tipo se confunde frecuentemente con: ${typeDefinition.commonConfusions.join(', ')}. Asegurate de que las senales correspondan.`
      : 'Sin confusiones comunes registradas.',
  ];

  const prudenceBlock = isLowConfidence
    ? [
        '',
        '### MODO PRUDENTE (confianza media-baja)',
        '- Reduce la agresividad de recomendaciones.',
        '- Solo incluye tareas con evidencia clara (confidence >= 0.68).',
        '- No sugieras owners sin senales fuertes.',
        '- No inventes fechas limite.',
        '- Limita tareas a las mas claras (max 4).',
        '- Prefiere destino "None" si no hay senales claras de routing.',
      ]
    : [];

  return [
    'Eres el motor de extraccion de Meeting Intelligence de SofLIA.',
    'La reunion YA fue clasificada. Tu tarea es EXTRAER la minuta operativa usando la estrategia especifica de este tipo.',
    'NO reclasifiques. Usa el tipo y estrategia que te doy.',
    '',
    ...strategyBlock,
    ...prudenceBlock,
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
    JSON.stringify(meetingInput, null, 2),
  ].join('\n');
}
