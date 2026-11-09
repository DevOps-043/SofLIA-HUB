import { executeWhatsAppTools } from '../whatsapp-tool-executor';
import type { AgentLoopState } from './agent-loop-types';
import { buildToolContext } from './agent-loop-tool-context';
import { updateEvidenceFromToolResult } from './agent-loop-evidence';
import { summarizeFunctionResponses } from './loop-helpers';
import { responseFingerprint } from './tool-fingerprint';
import { createLogger } from '../utils/logger';
import { randomUUID } from 'node:crypto';
import { observeToolNames } from '../whatsapp/tool-observation';

const log = createLogger('whatsapp-observacion');

export async function executeToolsAndTrackEvidence(
  state: AgentLoopState,
  functionCalls: any[],
  toolSignature: string,
  toolNames: string[],
) {
  const started = Date.now(), correlationId = randomUUID();
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
  const responseSignature = responseFingerprint(state, functionResponses.responses);
  const observedNames = observeToolNames(toolNames);
  state.toolLoopTrace.push({ iteration: state.toolLoopTrace.length + 1, toolSignature, responseSignature,
    toolNames: observedNames, hadFailure: responseSummary.some(item => item.success === false || item.hasError === true) });
  try {
    await state.agent.waService.recordHistory({
      direction: 'system', kind: 'tool', jid: state.jid, senderNumber: state.senderNumber,
      groupJid: state.isGroup ? state.jid : null, isGroup: state.isGroup,
      tool: { names: observedNames, summary: responseSummary }, source: 'tool-loop',
      metadata: { correlationId, durationMs: Math.max(0, Date.now() - started) },
    });
  } catch { log.warn({ correlationId }, 'No se pudo registrar la observación de herramientas WhatsApp.'); }
  return { functionResponses, responseSummary, responseSignature };
}
