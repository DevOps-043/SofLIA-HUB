import type { MeetingContextPack } from '../meeting-context-pack';
import type { MeetingAnalysisResult } from '../meeting-types';
import { DEFAULT_BLOCKED_ACTIONS } from './constants';

export function fillEmptySections(
  normalized: MeetingAnalysisResult,
  fallback: MeetingAnalysisResult,
): void {
  if (normalized.keyPoints.length === 0) normalized.keyPoints = fallback.keyPoints;
  if (normalized.decisions.length === 0) normalized.decisions = fallback.decisions;
  if (normalized.agreements.length === 0) normalized.agreements = fallback.agreements;
  if (normalized.tasks.length === 0) normalized.tasks = fallback.tasks;
  if (normalized.risks.length === 0) normalized.risks = fallback.risks;
  if (normalized.openQuestions.length === 0) normalized.openQuestions = fallback.openQuestions;
  if (normalized.unresolvedItems.length === 0) normalized.unresolvedItems = fallback.unresolvedItems;
}

export function applyConfidenceSafetyRules(
  normalized: MeetingAnalysisResult,
  contextPack: MeetingContextPack,
): void {
  if (normalized.meetingType.confidence < contextPack.fallbackThreshold) {
    normalized.destinationRecommendation = {
      suggestedDestination: 'None',
      confidence: Math.min(normalized.destinationRecommendation.confidence, 0.45),
      reason: normalized.destinationRecommendation.reason || 'La clasificacion es fragil y requiere revision humana.',
    };
  } else if (normalized.meetingType.confidence <= contextPack.reducedAggressivenessUpper) {
    normalized.tasks = normalized.tasks
      .filter((task) => task.confidence >= 0.68)
      .slice(0, 4);
    normalized.messageDrafts = (normalized.messageDrafts || []).filter((draft) => draft.kind !== 'owner_confirmation');
  }
}

export function enforceHumanGovernance(normalized: MeetingAnalysisResult): void {
  normalized.governance = {
    autonomyLevelApplied: Math.min(Math.max(normalized.governance.autonomyLevelApplied, 0), 2),
    sensitiveActionsBlocked: normalized.governance.sensitiveActionsBlocked.length > 0
      ? normalized.governance.sensitiveActionsBlocked
      : DEFAULT_BLOCKED_ACTIONS,
    requiresHumanApproval: true,
    explanationVisible: true,
  };

  normalized.tasks = normalized.tasks.map((task) => ({
    ...task,
    requiresHumanReview: true,
  }));
}
