import { appendBulkLabelVerificationResponse } from './bulk-label-verification';
import { stableJson } from './loop-helpers';
import type { AgentLoopState } from './agent-loop-types';
import { enforceEvidenceOrder } from './agent-loop-evidence';
import { executeToolsAndTrackEvidence } from './agent-loop-tool-execution';
import { guardRepeatedToolSignature, isPollLikeNoProgress } from './agent-loop-signature-guard';
import { handlePollNoProgress, handleRepeatedFailure } from './agent-loop-tool-guards';

type ToolCallAgentResponse = { done: true; text: string } | { done: false };

export async function handleToolCallAgentResponse(
  state: AgentLoopState,
  functionCalls: any[],
): Promise<ToolCallAgentResponse> {
  const toolNames = functionCalls.map((part) => part.functionCall?.name).filter(Boolean);
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
    const failureDecision = handleRepeatedFailure(state, toolNames, responseSummary, repeatedFailure);
    return 'text' in failureDecision ? { done: true, text: failureDecision.text } : { done: false };
  }
  if (isPollLikeNoProgress(state, toolSignature, responseSignature, toolNames)) {
    const pollDecision = handlePollNoProgress(state, toolNames);
    return 'text' in pollDecision ? { done: true, text: pollDecision.text } : { done: false };
  }

  await appendBulkLabelVerificationResponse({
    bulkLabelsToVerify: functionResponses.bulkLabelsToVerify || undefined,
    gmailService: state.agent.gmailService,
    functionResponses: functionResponses.responses,
  });
  state.response = await state.chatSession.sendMessage(functionResponses.responses as any);
  return { done: false };
}
