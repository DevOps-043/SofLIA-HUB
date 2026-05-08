import {
  LOCAL_EVIDENCE_TOOLS,
  LOCAL_VISUAL_EVIDENCE_TOOLS,
  REMOTE_EVIDENCE_TOOLS,
} from '../constants';
import type { EvidenceMode } from '../types';

export function getEvidenceModeFromToolCall(
  functionCall: { name?: string; args?: Record<string, any> },
): EvidenceMode {
  const toolName = functionCall.name || '';
  if (REMOTE_EVIDENCE_TOOLS.has(toolName)) return 'remote';

  if (toolName === 'use_computer') {
    const backend = String(functionCall.args?.backend || '').toLowerCase();
    const urlLikeArg = String(functionCall.args?.start_url || functionCall.args?.url || '').toLowerCase();
    return backend === 'browser' || urlLikeArg.length > 0 ? 'remote' : 'local_visual';
  }

  if (LOCAL_VISUAL_EVIDENCE_TOOLS.has(toolName)) return 'local_visual';
  if (LOCAL_EVIDENCE_TOOLS.has(toolName)) return 'local';
  return 'neutral';
}
