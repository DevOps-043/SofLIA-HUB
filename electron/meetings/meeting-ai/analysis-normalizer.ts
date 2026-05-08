import type { MeetingContextPack } from '../meeting-context-pack';
import type { MeetingAnalysisResult } from '../meeting-types';
import type { ExtractMeetingAssetInput } from './internal-types';
import { buildFallbackMeetingAnalysis } from './fallback-analysis';
import { getMeetingTypeDefinition } from './text-helpers';
import {
  asConfidence,
  asString,
  getObject,
} from './value-helpers';
import {
  applyConfidenceSafetyRules,
  enforceHumanGovernance,
  fillEmptySections,
} from './analysis-safety';
import { buildNormalizedAnalysis } from './analysis-builder';

export function normalizeMeetingAnalysisResult(
  rawAnalysis: unknown | null,
  input: ExtractMeetingAssetInput,
  contextPack: MeetingContextPack,
): MeetingAnalysisResult {
  const fallback = buildFallbackMeetingAnalysis(input, contextPack);
  if (!rawAnalysis || typeof rawAnalysis !== 'object') return fallback;

  const rawObject = rawAnalysis as Record<string, unknown>;
  const allowedTypes = new Set(contextPack.meetingTypes.map((meetingType) => meetingType.id));
  const rawMeetingType = getObject(rawObject.meetingType);
  let suggestedType = asString(rawMeetingType?.suggestedType) || fallback.meetingType.suggestedType;
  if (!allowedTypes.has(suggestedType)) suggestedType = fallback.meetingType.suggestedType;

  const typeConfidence = asConfidence(rawMeetingType?.confidence, fallback.meetingType.confidence);
  if (typeConfidence < contextPack.fallbackThreshold) suggestedType = 'fallback_general_operational';

  const typeDefinition = getMeetingTypeDefinition(contextPack, suggestedType)
    || getMeetingTypeDefinition(contextPack, 'fallback_general_operational');
  const normalized = buildNormalizedAnalysis(rawObject, rawMeetingType, {
    fallback,
    suggestedType,
    typeConfidence,
    typeDefinition,
    allowedTypes,
  });

  if (normalized.analysisStrategy.extractionFocus.length === 0) {
    normalized.analysisStrategy.extractionFocus = typeDefinition?.extractionFocus || fallback.analysisStrategy.extractionFocus;
  }
  fillEmptySections(normalized, fallback);
  applyConfidenceSafetyRules(normalized, contextPack);
  enforceHumanGovernance(normalized);
  return normalized;
}
