import { getSessionOpenAIClient } from '../../ai-provider/session-client';
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
  input: ExtractMeetingAssetInput;
  contextPack: MeetingContextPack;
}): Promise<unknown | null> {
  try {
    const client = await getSessionOpenAIClient();
    const generate = async (prompt: string, maxOutputTokens: number) => {
      const response = await client.responses.create({
        model: EXTRACTION_MODEL, input: prompt, store: false,
        max_output_tokens: maxOutputTokens, reasoning: { effort: 'low' },
        text: { format: { type: 'json_object' } },
      });
      return response.output_text;
    };
    const classificationResult = await generate(
      buildClassificationPrompt(params.input, params.contextPack), 2048,
    );
    const classification = parseJson<AIClassification>(classificationResult);
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
    const extractionResult = await generate(extractionPrompt, 8192);
    const extraction = parseJson<unknown>(extractionResult);
    console.log(`[MeetingAIService] Fase 2 completa: extraccion con estrategia ${resolved.typeDefinition.displayName}`);

    return mergeClassificationIntoExtraction(extraction, classification, resolved);
  } catch {
    console.warn('[MeetingAIService] Se utilizó extracción local tras fallar la inferencia.');
    return null;
  }
}
