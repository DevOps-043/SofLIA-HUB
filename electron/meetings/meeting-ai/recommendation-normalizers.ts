import type {
  MeetingAnalysisDestinationRecommendation,
  MeetingAnalysisFollowUpRecommendation,
  MeetingAnalysisResult,
} from '../meeting-types';
import {
  asConfidence,
  asString,
  asStringArray,
  clampNumber,
  getObject,
  limitStrings,
  normalizeDestinationValue,
  normalizeFollowUpType,
} from './value-helpers';

export function normalizeUnresolvedItems(raw: unknown): MeetingAnalysisResult['unresolvedItems'] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      const source = getObject(item);
      return {
        item: asString(source?.item),
        reasonOpen: asString(source?.reasonOpen) || 'Pendiente de definicion o cierre.',
        confidence: asConfidence(source?.confidence, 0.6),
      };
    })
    .filter((item) => item.item);
}

export function normalizeFollowUpRecommendation(
  raw: unknown,
  fallback: MeetingAnalysisFollowUpRecommendation,
): MeetingAnalysisFollowUpRecommendation {
  const source = getObject(raw);
  const suggested = typeof source?.suggested === 'boolean' ? source.suggested : fallback.suggested;
  const type = normalizeFollowUpType(source?.type);
  return {
    suggested,
    type: suggested ? (type || fallback.type || 'validation') : undefined,
    description: suggested ? (asString(source?.description) || fallback.description) : undefined,
    confidence: asConfidence(source?.confidence, fallback.confidence),
    reason: asString(source?.reason) || fallback.reason,
  };
}

export function normalizeDestinationRecommendation(
  raw: unknown,
  fallback: MeetingAnalysisDestinationRecommendation,
): MeetingAnalysisDestinationRecommendation {
  const source = getObject(raw);
  const suggestedDestination = normalizeDestinationValue(source?.suggestedDestination) || fallback.suggestedDestination;
  return {
    suggestedDestination,
    confidence: asConfidence(source?.confidence, fallback.confidence),
    reason: asString(source?.reason) || fallback.reason,
  };
}

export function normalizeGovernance(raw: unknown): MeetingAnalysisResult['governance'] {
  const source = getObject(raw);
  return {
    autonomyLevelApplied: clampNumber(
      typeof source?.autonomyLevelApplied === 'number' ? source.autonomyLevelApplied : 2,
      0,
      2,
    ),
    sensitiveActionsBlocked: limitStrings(asStringArray(source?.sensitiveActionsBlocked), 8),
    requiresHumanApproval: typeof source?.requiresHumanApproval === 'boolean' ? source.requiresHumanApproval : true,
    explanationVisible: typeof source?.explanationVisible === 'boolean' ? source.explanationVisible : true,
  };
}
