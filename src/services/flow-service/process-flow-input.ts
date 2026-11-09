import { FLOW_MODEL } from './constants';
import { observeFlowSession, type FlowSession } from './session';
import { getPublicAiErrorMessage } from '../gemini-chat/public-error';
import { generateNativeFlow, NativeFlowRevokedError } from './native';
import { buildDeterministicAnalysis, shouldAttachScreenshot } from './deterministic-analysis';
import { buildFallbackAnalysis } from './fallback-analysis';
import { normalizeAnalysis } from './analysis-normalizer';
import { parseJsonPayload } from './normalizers';
import type { FlowAnalysisResult, RawFlowAnalysis } from './types';

async function requestFlowAnalysis(transcript: string, base64Image: string | undefined, scope: FlowSession): Promise<FlowAnalysisResult> {
  const native = await generateNativeFlow({ kind: 'analysis', text: transcript, ...(base64Image ? { image: base64Image } : {}) });
  scope.assert();
  return normalizeAnalysis(parseJsonPayload<RawFlowAnalysis>(native.trim()), transcript);
}

export async function processFlowInput(text: string, base64Image?: string): Promise<FlowAnalysisResult> {
  const transcript = text.trim();
  const deterministicAnalysis = buildDeterministicAnalysis(transcript);
  if (deterministicAnalysis) {
    return deterministicAnalysis;
  }

  const includeScreenshot = Boolean(base64Image && shouldAttachScreenshot(transcript));
  const scope = observeFlowSession();
  try {
  try {
    return await requestFlowAnalysis(transcript, includeScreenshot ? base64Image : undefined, scope);
  } catch (error) {
    if (error instanceof NativeFlowRevokedError) throw error;
    scope.assert();
    console.error('[Flow] No se pudo procesar la solicitud:', {
      message: getPublicAiErrorMessage(error),
      model: FLOW_MODEL,
      includeScreenshot,
    });
  }

  if (includeScreenshot) {
    try {
      return await requestFlowAnalysis(transcript, undefined, scope);
    } catch (retryError) {
      if (retryError instanceof NativeFlowRevokedError) throw retryError;
      scope.assert();
      console.error('[Flow] Falló el reintento sin captura:', {
        message: getPublicAiErrorMessage(retryError),
        model: FLOW_MODEL,
      });
    }
  }

  scope.assert();
  return await buildFallbackAnalysis(transcript, includeScreenshot ? base64Image : undefined, scope);
  } finally { scope.dispose(); }
}
