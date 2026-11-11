import { observeFlowSession, type FlowSession } from './session';
import { generateNativeFlow, NativeFlowRevokedError } from './native';
import { inferIntentFromAction } from './intent-inference';
import type { FlowAnalysisResult, FlowMode } from './types';

async function generateDirectFallbackResponse(text: string, base64Image: string | undefined, scope: FlowSession): Promise<string> {
  const native = await generateNativeFlow({ kind: 'fallback', text, ...(base64Image ? { image: base64Image } : {}) });
  scope.assert();
  return native.trim();
}

export async function buildFallbackAnalysis(transcript: string, base64Image?: string, parentScope?: FlowSession): Promise<FlowAnalysisResult> {
  const scope = parentScope ?? observeFlowSession();
  try {
  const intent = inferIntentFromAction(null, transcript);
  const mode: FlowMode = intent === 'rewrite' || intent === 'email' ? 'draft' : 'answer';

  try {
    const response = await generateDirectFallbackResponse(transcript, base64Image, scope);
    if (response) {
      return {
        intent,
        mode,
        title: '',
        lead: '',
        response,
        confidence: 0.44,
        transcript,
        missing: [],
        chatPrompt: transcript,
        action: null,
      };
    }
  } catch (error) {
    if (error instanceof NativeFlowRevokedError) throw error;
    scope.assert();
    console.error('[Flow] No se pudo obtener una respuesta alternativa.');
  }

  return {
    intent,
    mode,
    title: '',
    lead: '',
    response: 'No pude responder con claridad esta vez. Intenta repetirlo o escribirlo en el panel.',
    confidence: 0.22,
    transcript,
    missing: [],
    chatPrompt: transcript,
    action: null,
  };
  } finally { if (!parentScope) scope.dispose(); }
}
