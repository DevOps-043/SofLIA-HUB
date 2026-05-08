import type { MeetingTypeDefinition } from '../meeting-context-pack';
import type { MeetingAnalysisResult } from '../meeting-types';
import { buildMeetingTypeReasonText, buildStrategyReasonText } from './reason-builders';
import {
  asNullableString,
  asString,
  asStringArray,
  getObject,
  limitStrings,
  normalizeStringItems,
} from './value-helpers';
import {
  normalizeAgreements,
  normalizeDecisions,
  normalizeMessageDrafts,
  normalizeOpenQuestions,
  normalizeRisks,
  normalizeTasks,
} from './item-normalizers';
import {
  normalizeDestinationRecommendation,
  normalizeFollowUpRecommendation,
  normalizeGovernance,
  normalizeUnresolvedItems,
} from './recommendation-normalizers';
import { normalizeAlternativeTypes } from './alternative-type-normalizer';

export function buildNormalizedAnalysis(
  rawObject: Record<string, unknown>,
  rawMeetingType: Record<string, unknown> | null,
  params: {
    fallback: MeetingAnalysisResult;
    suggestedType: string;
    typeConfidence: number;
    typeDefinition?: MeetingTypeDefinition | null;
    allowedTypes: Set<string>;
  },
): MeetingAnalysisResult {
  const detectedContext = getObject(rawObject.detectedContext);
  const analysisStrategy = getObject(rawObject.analysisStrategy);
  const relevantSignals = limitStrings(asStringArray(detectedContext?.relevantSignals), 8);
  const meetingObjective = limitStrings(asStringArray(detectedContext?.meetingObjective), 6);
  const reason = asString(rawMeetingType?.reason)
    || buildMeetingTypeReasonText(params.typeDefinition || null, relevantSignals, params.typeConfidence, params.fallback.meetingType.reason);

  return {
    meetingType: {
      suggestedType: params.suggestedType,
      alternativeTypes: normalizeAlternativeTypes(rawMeetingType?.alternativeTypes, params.fallback, params.allowedTypes),
      confidence: params.typeConfidence,
      reason,
    },
    detectedContext: {
      project: asNullableString(detectedContext?.project),
      team: asNullableString(detectedContext?.team),
      meetingObjective: meetingObjective.length > 0 ? meetingObjective : params.fallback.detectedContext.meetingObjective,
      relevantSignals: relevantSignals.length > 0 ? relevantSignals : params.fallback.detectedContext.relevantSignals,
    },
    analysisStrategy: {
      strategyId: asString(analysisStrategy?.strategyId) || params.suggestedType,
      strategyName: asString(analysisStrategy?.strategyName) || params.typeDefinition?.displayName || params.fallback.analysisStrategy.strategyName,
      whyThisStrategy: asString(analysisStrategy?.whyThisStrategy) || buildStrategyReasonText(params.typeDefinition || null, relevantSignals, reason),
      extractionFocus: limitStrings(asStringArray(analysisStrategy?.extractionFocus), 8),
    },
    executiveSummary: asString(rawObject.executiveSummary) || params.fallback.executiveSummary,
    keyPoints: normalizeStringItems(rawObject.keyPoints),
    decisions: normalizeDecisions(rawObject.decisions),
    agreements: normalizeAgreements(rawObject.agreements),
    tasks: normalizeTasks(rawObject.tasks),
    risks: normalizeRisks(rawObject.risks),
    openQuestions: normalizeOpenQuestions(rawObject.openQuestions),
    unresolvedItems: normalizeUnresolvedItems(rawObject.unresolvedItems),
    followUpRecommendation: normalizeFollowUpRecommendation(rawObject.followUpRecommendation, params.fallback.followUpRecommendation),
    destinationRecommendation: normalizeDestinationRecommendation(rawObject.destinationRecommendation, params.fallback.destinationRecommendation),
    messageDrafts: normalizeMessageDrafts(rawObject.messageDrafts),
    governance: normalizeGovernance(rawObject.governance),
  };
}
