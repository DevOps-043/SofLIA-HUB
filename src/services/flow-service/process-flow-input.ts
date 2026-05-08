import { FLOW_MODEL } from './constants';
import { getGenAI } from './ai-client';
import { buildDeterministicAnalysis, shouldAttachScreenshot } from './deterministic-analysis';
import { buildFallbackAnalysis } from './fallback-analysis';
import { normalizeAnalysis } from './analysis-normalizer';
import { parseJsonPayload } from './normalizers';
import { buildFlowRequestParts } from './request-parts';
import type { FlowAnalysisResult, RawFlowAnalysis } from './types';

async function requestFlowAnalysis(transcript: string, base64Image?: string): Promise<FlowAnalysisResult> {
  const ai = await getGenAI();
  const model = ai.getGenerativeModel({
    model: FLOW_MODEL,
    generationConfig: { responseMimeType: 'application/json' },
  });
  const result = await model.generateContent(buildFlowRequestParts(transcript, base64Image));
  const parsed = parseJsonPayload<RawFlowAnalysis>(result.response.text().trim());
  return normalizeAnalysis(parsed, transcript);
}

export async function processFlowInput(text: string, base64Image?: string): Promise<FlowAnalysisResult> {
  const transcript = text.trim();
  const deterministicAnalysis = buildDeterministicAnalysis(transcript);
  if (deterministicAnalysis) {
    return deterministicAnalysis;
  }

  const includeScreenshot = Boolean(base64Image && shouldAttachScreenshot(transcript));
  try {
    return await requestFlowAnalysis(transcript, includeScreenshot ? base64Image : undefined);
  } catch (error) {
    console.error('Flow processing error:', {
      message: error instanceof Error ? error.message : String(error),
      model: FLOW_MODEL,
      includeScreenshot,
    });
  }

  if (includeScreenshot) {
    try {
      return await requestFlowAnalysis(transcript);
    } catch (retryError) {
      console.error('Flow processing retry without screenshot failed:', {
        message: retryError instanceof Error ? retryError.message : String(retryError),
        model: FLOW_MODEL,
      });
    }
  }

  return buildFallbackAnalysis(transcript, includeScreenshot ? base64Image : undefined);
}
