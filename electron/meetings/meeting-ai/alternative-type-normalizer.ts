import type { MeetingAnalysisResult } from '../meeting-types';
import {
  asConfidence,
  asString,
  getObject,
} from './value-helpers';

export function normalizeAlternativeTypes(
  raw: unknown,
  fallback: MeetingAnalysisResult,
  allowedTypes: Set<string>,
): MeetingAnalysisResult['meetingType']['alternativeTypes'] {
  if (!Array.isArray(raw)) return fallback.meetingType.alternativeTypes;

  const normalized = raw
    .map((item) => {
      const source = getObject(item);
      return {
        type: asString(source?.type),
        confidence: asConfidence(source?.confidence, 0.4),
        reason: asString(source?.reason) || 'Tipo alternativo sugerido por senales parciales.',
      };
    })
    .filter((item) => item.type && allowedTypes.has(item.type));

  return normalized.length > 0 ? normalized.slice(0, 3) : fallback.meetingType.alternativeTypes;
}
