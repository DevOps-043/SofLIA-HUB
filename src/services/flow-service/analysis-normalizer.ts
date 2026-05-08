import {
  asNumber,
  asString,
  asStringArray,
  clampConfidence,
  normalizeAction,
  normalizeIntent,
  normalizeMode,
} from './normalizers';
import { inferIntentFromAction } from './intent-inference';
import type { FlowAnalysisResult, FlowMode, RawFlowAnalysis } from './types';

function userExplicitlyAskedToContinueInChat(transcript: string): boolean {
  const normalized = transcript.toLowerCase();
  return [
    'chat principal',
    'manda al chat',
    'mandalo al chat',
    'envialo al chat',
    'continua en el chat',
    'continuar en el chat',
    'integra en chat',
    'pasalo al chat',
  ].some((term) => normalized.includes(term));
}

export function normalizeAnalysis(rawAnalysis: RawFlowAnalysis, transcript: string): FlowAnalysisResult {
  const requestedAction = normalizeAction(rawAnalysis.action);
  const action =
    requestedAction?.type === 'send_to_chat' && !userExplicitlyAskedToContinueInChat(transcript)
      ? null
      : requestedAction;
  const inferredIntent = inferIntentFromAction(action, transcript);
  const modeFallback: FlowMode = action ? 'action' : inferredIntent === 'rewrite' || inferredIntent === 'email' ? 'draft' : 'answer';

  return {
    intent: normalizeIntent(rawAnalysis.intent, inferredIntent),
    mode: normalizeMode(rawAnalysis.mode, modeFallback),
    title: asString(rawAnalysis.title),
    lead: asString(rawAnalysis.lead),
    response: asString(rawAnalysis.response) || 'Ya entendi tu solicitud.',
    confidence: clampConfidence(asNumber(rawAnalysis.confidence, 0.68)),
    transcript,
    missing: asStringArray(rawAnalysis.missing),
    chatPrompt: asString(rawAnalysis.chatPrompt) || asString(rawAnalysis.response) || transcript,
    action,
  };
}
