import type { MeetingContextPack } from '../meeting-context-pack';
import type { MeetingAnalysisResult } from '../meeting-types';
import type { ExtractMeetingAssetInput } from './internal-types';
import { DEFAULT_BLOCKED_ACTIONS } from './constants';
import {
  buildExecutiveSummary,
  getLines,
} from './text-helpers';
import {
  buildKeyPoints,
  extractAgreementSignals,
  extractDecisionSignals,
  extractOpenQuestionSignals,
  extractRiskSignals,
  extractTaskSignals,
  extractUnresolvedSignals,
} from './legacy-signal-extractors';
import { buildMessageDrafts } from './message-draft-builders';
import {
  buildDestinationRecommendation,
  buildFollowUpRecommendation,
} from './recommendation-builders';
import { classifyMeetingFromText } from './meeting-classifier';

export function buildFallbackMeetingAnalysis(
  input: ExtractMeetingAssetInput,
  contextPack: MeetingContextPack,
): MeetingAnalysisResult {
  const lines = getLines(input.sourceArtifact.normalized_text);
  const classification = classifyMeetingFromText(input, contextPack);
  const decisions = extractDecisionSignals(lines);
  const agreements = extractAgreementSignals(lines);
  const tasks = extractTaskSignals(lines);
  const risks = extractRiskSignals(lines);
  const openQuestions = extractOpenQuestionSignals(lines);
  const unresolvedItems = extractUnresolvedSignals(lines, risks);
  const keyPoints = buildKeyPoints(lines, tasks, risks, decisions);
  const followUpRecommendation = buildFollowUpRecommendation(tasks, risks, openQuestions);
  const destinationRecommendation = buildDestinationRecommendation(
    classification.suggestedType,
    classification.confidence,
    classification.reason,
    contextPack,
  );

  return {
    meetingType: {
      suggestedType: classification.suggestedType,
      alternativeTypes: classification.alternativeTypes,
      confidence: classification.confidence,
      reason: classification.reason,
    },
    detectedContext: {
      project: null,
      team: null,
      meetingObjective: classification.objectives,
      relevantSignals: classification.relevantSignals,
    },
    analysisStrategy: {
      strategyId: classification.suggestedType,
      strategyName: classification.strategyName,
      whyThisStrategy: classification.strategyReason,
      extractionFocus: classification.extractionFocus,
    },
    executiveSummary: buildExecutiveSummary(lines, tasks.length, decisions.length, risks.length),
    keyPoints,
    decisions: decisions.map((decision) => ({
      description: decision.value,
      confidence: decision.confidence,
      evidence: decision.evidence,
    })),
    agreements: agreements.map((agreement) => ({
      description: agreement.value,
      confidence: agreement.confidence,
      evidence: agreement.evidence,
    })),
    tasks,
    risks,
    openQuestions,
    unresolvedItems,
    followUpRecommendation,
    destinationRecommendation,
    messageDrafts: buildMessageDrafts(destinationRecommendation, followUpRecommendation, keyPoints, tasks),
    governance: {
      autonomyLevelApplied: 2,
      sensitiveActionsBlocked: DEFAULT_BLOCKED_ACTIONS,
      requiresHumanApproval: true,
      explanationVisible: true,
    },
  };
}
