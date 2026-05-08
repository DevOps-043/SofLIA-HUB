import type { MeetingContextPack, MeetingTypeDefinition } from '../meeting-context-pack';
import { clampNumber } from './value-helpers';
import { getMeetingTypeDefinition } from './text-helpers';

export interface AIClassification {
  suggestedType?: string;
  alternativeTypes?: unknown[];
  confidence?: number;
  reason?: string;
  relevantSignals?: string[];
  detectedContext?: { project?: string; team?: string; meetingObjective?: string[] };
}

export interface ResolvedAIClassification {
  resolvedType: string;
  resolvedConfidence: number;
  typeDefinition: MeetingTypeDefinition;
}

export function resolveAIClassification(
  classification: AIClassification | null,
  contextPack: MeetingContextPack,
): ResolvedAIClassification {
  const allowedTypes = new Set(contextPack.meetingTypes.map((meetingType) => meetingType.id));
  let resolvedType = classification?.suggestedType || 'fallback_general_operational';
  if (!allowedTypes.has(resolvedType)) {
    resolvedType = 'fallback_general_operational';
  }

  const resolvedConfidence = clampNumber(
    typeof classification?.confidence === 'number' ? classification.confidence : 0.4,
    0.05,
    0.97,
  );

  if (resolvedConfidence < contextPack.fallbackThreshold) {
    resolvedType = 'fallback_general_operational';
  }

  const typeDefinition = getMeetingTypeDefinition(contextPack, resolvedType)
    || getMeetingTypeDefinition(contextPack, 'fallback_general_operational')!;

  return { resolvedType, resolvedConfidence, typeDefinition };
}

export function mergeClassificationIntoExtraction(
  extraction: unknown,
  classification: AIClassification | null,
  resolved: ResolvedAIClassification,
): unknown {
  if (!extraction || typeof extraction !== 'object') {
    return extraction;
  }

  const output = extraction as Record<string, unknown>;
  if (!output.meetingType || typeof output.meetingType !== 'object') {
    output.meetingType = {};
  }

  const meetingType = output.meetingType as Record<string, unknown>;
  meetingType.suggestedType = resolved.resolvedType;
  meetingType.confidence = resolved.resolvedConfidence;
  meetingType.reason = classification?.reason || meetingType.reason;
  meetingType.alternativeTypes = classification?.alternativeTypes || meetingType.alternativeTypes;
  return output;
}
