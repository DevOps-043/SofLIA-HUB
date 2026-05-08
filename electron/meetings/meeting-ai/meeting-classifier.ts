import type { MeetingContextPack } from '../meeting-context-pack';
import type { ExtractMeetingAssetInput } from './internal-types';
import { clampNumber, normalizeText } from './value-helpers';
import { getMeetingTypeDefinition } from './text-helpers';

export function classifyMeetingFromText(input: ExtractMeetingAssetInput, contextPack: MeetingContextPack) {
  const title = normalizeText(input.meetingTitle || '');
  const body = normalizeText(input.sourceArtifact.normalized_text);
  const hint = normalizeText(input.meetingType);
  const candidates = contextPack.meetingTypes
    .filter((meetingType) => meetingType.id !== 'fallback_general_operational')
    .map((meetingType) => {
      const titleMatches = meetingType.titleKeywords.filter((keyword) => title.includes(normalizeText(keyword)));
      const languageMatches = meetingType.languagePatterns.filter((pattern) => body.includes(normalizeText(pattern)));
      const structuralMatches = meetingType.structuralSignals.filter((signal) => body.includes(normalizeText(signal)));
      const negativeMatches = meetingType.negativeSignals.filter((signal) => body.includes(normalizeText(signal)));
      const hintMatch = hint && [meetingType.id, meetingType.displayName].some((token) => hint.includes(normalizeText(token)));
      const score = 0.18 * Math.min(titleMatches.length, 2)
        + 0.07 * Math.min(languageMatches.length, 4)
        + 0.06 * Math.min(structuralMatches.length, 3)
        + (hintMatch ? 0.08 : 0)
        - 0.1 * Math.min(negativeMatches.length, 2);
      const confidence = clampNumber((score > 0 ? 0.18 : 0.08) + score, 0.05, 0.97);
      const relevantSignals = [
        ...titleMatches.map((match) => `titulo:${match}`),
        ...languageMatches.slice(0, 3).map((match) => `lenguaje:${match}`),
        ...structuralMatches.slice(0, 2).map((match) => `estructura:${match}`),
      ];
      return {
        meetingType,
        confidence,
        relevantSignals,
        reason: relevantSignals.length > 0
          ? `Coinciden senales con ${meetingType.displayName}: ${relevantSignals.join(', ')}.`
          : `Hay senales parciales para ${meetingType.displayName}, pero el texto es limitado.`,
      };
    })
    .sort((left, right) => right.confidence - left.confidence);

  return selectMeetingClassification(candidates, contextPack);
}

function selectMeetingClassification(
  candidates: ReturnType<typeof buildCandidateShape>[],
  contextPack: MeetingContextPack,
) {
  const fallbackDefinition = getMeetingTypeDefinition(contextPack, 'fallback_general_operational');
  const bestMatch = candidates[0];
  if (!bestMatch || bestMatch.confidence < contextPack.fallbackThreshold || !fallbackDefinition) {
    return {
      suggestedType: 'fallback_general_operational',
      confidence: bestMatch ? Math.min(bestMatch.confidence, 0.55) : 0.35,
      reason: bestMatch
        ? `La clasificacion es ambigua. La mejor coincidencia fue ${bestMatch.meetingType.displayName}, pero no supera el umbral de ${contextPack.fallbackThreshold.toFixed(2)}.`
        : 'No hay senales suficientes para una taxonomia especifica.',
      relevantSignals: bestMatch?.relevantSignals || [],
      objectives: fallbackDefinition?.extractionFocus || ['resultado operativo minimo seguro'],
      strategyName: fallbackDefinition?.displayName || 'Fallback General Operational Meeting',
      strategyReason: 'Se usa el modo fallback por baja confianza o senales insuficientes.',
      extractionFocus: fallbackDefinition?.extractionFocus || ['resultado operativo minimo seguro'],
      alternativeTypes: candidates.slice(0, 3).map((candidate) => buildAlternative(candidate)),
    };
  }

  return {
    suggestedType: bestMatch.meetingType.id,
    confidence: bestMatch.confidence,
    reason: bestMatch.reason,
    relevantSignals: bestMatch.relevantSignals,
    objectives: bestMatch.meetingType.expectedStructure.slice(0, 4),
    strategyName: bestMatch.meetingType.displayName,
    strategyReason: `Se selecciono la estrategia de ${bestMatch.meetingType.displayName} por convergencia de senales.`,
    extractionFocus: bestMatch.meetingType.extractionFocus,
    alternativeTypes: candidates.slice(1, 4).map((candidate) => buildAlternative(candidate)),
  };
}

function buildCandidateShape(candidate: unknown) {
  return candidate as {
    meetingType: { id: string; displayName: string; expectedStructure: string[]; extractionFocus: string[] };
    confidence: number;
    relevantSignals: string[];
    reason: string;
  };
}

function buildAlternative(candidate: ReturnType<typeof buildCandidateShape>) {
  return { type: candidate.meetingType.id, confidence: candidate.confidence, reason: candidate.reason };
}
