import type { GoogleGenerativeAI } from '@google/generative-ai';
import type { MeetingContextPack } from '../meeting-context-pack';
import type { ExtractMeetingAssetInput } from './internal-types';
import { EXTRACTION_MODEL } from './constants';
import {
  buildClassificationPrompt,
  buildExtractionPrompt,
  EXTRACTION_PROMPT_ID,
  EXTRACTION_PROMPT_VERSION,
} from './prompts';
import { registrarGeneracion } from '../../sdo/sdo-generation';
import { parseJson } from './value-helpers';
import {
  type AIClassification,
  mergeClassificationIntoExtraction,
  resolveAIClassification,
} from './ai-classification';

export async function tryExtractMeetingWithAI(params: {
  ai: GoogleGenerativeAI | null;
  input: ExtractMeetingAssetInput;
  contextPack: MeetingContextPack;
}): Promise<unknown | null> {
  if (!params.ai) return null;

  try {
    const model = params.ai.getGenerativeModel({
      model: EXTRACTION_MODEL,
      generationConfig: { responseMimeType: 'application/json' },
    });

    const classificationResult = await model.generateContent(
      buildClassificationPrompt(params.input, params.contextPack),
    );
    const classification = parseJson<AIClassification>(classificationResult.response.text());
    const resolved = resolveAIClassification(classification, params.contextPack);
    console.log(
      `[MeetingAIService] Fase 1 completa: tipo=${resolved.resolvedType}, confianza=${resolved.resolvedConfidence.toFixed(2)}`,
    );

    const extractionPrompt = buildExtractionPrompt(
      params.input,
      params.contextPack,
      resolved.typeDefinition,
      resolved.resolvedType,
      resolved.resolvedConfidence,
      classification?.reason || '',
      classification?.relevantSignals || [],
      classification?.alternativeTypes || [],
      classification?.detectedContext || {},
    );
    const extractionResult = await model.generateContent(extractionPrompt);
    const rawOutput = extractionResult.response.text();
    const extraction = parseJson<unknown>(rawOutput);
    console.log(`[MeetingAIService] Fase 2 completa: extraccion con estrategia ${resolved.typeDefinition.displayName}`);

    // Trazabilidad SDO: modelo + prompt (id/version/hash) + fuente. No
    // bloqueante: la extraccion no depende del registro de generacion.
    registrarGeneracion({
      trace_id: params.input.traceId,
      purpose: 'extraccion_meeting',
      model_used: EXTRACTION_MODEL,
      prompt_id: EXTRACTION_PROMPT_ID,
      prompt_version: EXTRACTION_PROMPT_VERSION,
      prompt_text: extractionPrompt,
      schema_version: 'meeting_asset.v1',
      output_object_refs: [{ object_type: 'meeting_run', object_id: params.input.meetingRunId }],
      ai_output_raw: rawOutput,
      confidence: resolved.resolvedConfidence,
      input_evidence_ids: [`sha256:${params.input.sourceArtifact.sha256}`],
    }).catch((error) => {
      console.warn('[MeetingAIService] No pude registrar la generacion en el SDO (no bloqueante):', error?.message || error);
    });

    return mergeClassificationIntoExtraction(extraction, classification, resolved);
  } catch (error) {
    console.warn('[MeetingAIService] AI extraction failed, using fallback:', error);
    return null;
  }
}
