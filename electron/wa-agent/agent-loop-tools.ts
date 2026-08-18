import { appendBulkLabelVerificationResponse } from './bulk-label-verification';
import { stableJson } from './loop-helpers';
import type { AgentLoopState } from './agent-loop-types';
import { enforceEvidenceOrder } from './agent-loop-evidence';
import { executeToolsAndTrackEvidence } from './agent-loop-tool-execution';
import { guardRepeatedToolSignature, isPollLikeNoProgress } from './agent-loop-signature-guard';
import { handlePollNoProgress, handleRepeatedFailure } from './agent-loop-tool-guards';
import { guardUnrequestedOperationalTools } from './tool-intent-guard';

type ToolCallAgentResponse = { done: true; text: string } | { done: false };

export async function handleToolCallAgentResponse(
  state: AgentLoopState,
  functionCalls: any[],
): Promise<ToolCallAgentResponse> {
  const toolNames = functionCalls.map((part) => part.functionCall?.name).filter(Boolean);
  const intentGuard = await guardUnrequestedOperationalTools(state, functionCalls);
  if (intentGuard) return intentGuard;

  if (await enforceEvidenceOrder(state, functionCalls)) return { done: false };

  const toolSignature = stableJson(functionCalls.map((part) => ({
    name: part.functionCall?.name,
    args: part.functionCall?.args || {},
  })));
  const loopGuard = await guardRepeatedToolSignature(state, toolNames, toolSignature);
  if (loopGuard.status === 'complete') return { done: true, text: loopGuard.text };
  if (loopGuard.status === 'retry') return { done: false };

  const { functionResponses, responseSummary, responseSignature } =
    await executeToolsAndTrackEvidence(state, functionCalls, toolSignature, toolNames);
  const repeatedFailure = state.toolLoopTrace.filter(
    (entry) => entry.toolSignature === toolSignature && entry.responseSignature === responseSignature && entry.hadFailure,
  ).length;
  if (repeatedFailure >= 2) {
    const failureDecision = await handleRepeatedFailure(state, toolNames, responseSummary, repeatedFailure);
    return 'text' in failureDecision ? { done: true, text: failureDecision.text } : { done: false };
  }
  if (isPollLikeNoProgress(state, toolSignature, responseSignature, toolNames)) {
    const pollDecision = await handlePollNoProgress(state, toolNames);
    return 'text' in pollDecision ? { done: true, text: pollDecision.text } : { done: false };
  }

  await appendBulkLabelVerificationResponse({
    bulkLabelsToVerify: functionResponses.bulkLabelsToVerify || undefined,
    gmailService: state.agent.gmailService,
    functionResponses: functionResponses.responses,
  });
  // `@google/genai` empaqueta estas partes como `role: "user"`, que es lo que
  // Gemini 3 acepta. El SDK legado las mandaba con `role: "function"` y la API
  // rechazaba el turno entero con 400.
  state.response = await state.chatSession.sendMessage({ message: functionResponses.responses as any });
  return { done: false };
}
