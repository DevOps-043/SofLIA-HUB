import { FLOW_MODEL } from './constants';
import { getGenAI } from './ai-client';
import { inferIntentFromAction } from './intent-inference';
import { buildFlowFallbackRequestParts } from './request-parts';
import type { FlowAnalysisResult, FlowMode } from './types';

async function generateDirectFallbackResponse(text: string, base64Image?: string): Promise<string> {
  const ai = await getGenAI();
  const model = ai.getGenerativeModel({ model: FLOW_MODEL });
  const result = await model.generateContent(buildFlowFallbackRequestParts(text, base64Image));
  return result.response.text().trim();
}

export async function buildFallbackAnalysis(transcript: string, base64Image?: string): Promise<FlowAnalysisResult> {
  const intent = inferIntentFromAction(null, transcript);
  const mode: FlowMode = intent === 'rewrite' || intent === 'email' ? 'draft' : 'answer';

  try {
    const response = await generateDirectFallbackResponse(transcript, base64Image);
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
    console.error('Flow fallback response error:', error);
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
}
