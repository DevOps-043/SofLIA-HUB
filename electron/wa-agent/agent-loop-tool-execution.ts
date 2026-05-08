import { executeWhatsAppTools } from '../whatsapp-tool-executor';
import type { AgentLoopState } from './agent-loop-types';
import { buildToolContext } from './agent-loop-tool-context';
import { updateEvidenceFromToolResult } from './agent-loop-evidence';
import { stableJson, summarizeFunctionResponses } from './loop-helpers';

export async function executeToolsAndTrackEvidence(
  state: AgentLoopState,
  functionCalls: any[],
  toolSignature: string,
  toolNames: string[],
) {
  const functionResponses = await executeWhatsAppTools(
    functionCalls,
    buildToolContext(state),
    state.jid,
    state.senderNumber,
    state.isGroup,
  );
  functionCalls.forEach((part, index) =>
    updateEvidenceFromToolResult(state, part, functionResponses.responses[index]?.functionResponse?.response),
  );
  const responseSummary = summarizeFunctionResponses(functionResponses.responses);
  const responseSignature = stableJson(responseSummary);
  state.toolLoopTrace.push({
    iteration: state.toolLoopTrace.length + 1,
    toolSignature,
    responseSignature,
    toolNames,
    hadFailure: responseSummary.some((item) => item.success === false || typeof item.error === 'string'),
  });
  return { functionResponses, responseSummary, responseSignature };
}
