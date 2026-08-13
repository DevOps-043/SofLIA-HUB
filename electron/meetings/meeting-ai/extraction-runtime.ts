import type { GoogleGenerativeAI } from '@google/generative-ai';
import type { MeetingContextPack } from '../meeting-context-pack';
import type { ExtractMeetingAssetInput } from './internal-types';
import { EXTRACTION_MODEL } from './constants';
import { buildClassificationPrompt, buildExtractionPrompt } from './prompts';
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
    const extraction = parseJson<unknown>(extractionResult.response.text());
    console.log(`[MeetingAIService] Fase 2 completa: extraccion con estrategia ${resolved.typeDefinition.displayName}`);

    return mergeClassificationIntoExtraction(extraction, classification, resolved);
  } catch (error) {
    console.warn('[MeetingAIService] AI extraction failed, using fallback:', error);
    return null;
  }
}
