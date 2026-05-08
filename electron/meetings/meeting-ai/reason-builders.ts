import type { MeetingTypeDefinition } from '../meeting-context-pack';
import type { MeetingAnalysisResult } from '../meeting-types';

export function buildOperationalSummaryText(analysis: MeetingAnalysisResult): string {
  const parts = [
    analysis.keyPoints.slice(0, 3).join(' '),
    `Destino sugerido: ${analysis.destinationRecommendation.suggestedDestination}.`,
    analysis.followUpRecommendation.suggested
      ? `Follow-up sugerido: ${analysis.followUpRecommendation.description || analysis.followUpRecommendation.type || 'validacion manual'}.`
      : null,
  ].filter(Boolean);

  return parts.join(' ').trim() || analysis.executiveSummary;
}

export function buildMeetingTypeReasonText(
  meetingType: MeetingTypeDefinition | null,
  relevantSignals: string[],
  confidence: number,
  fallbackReason: string,
): string {
  if (meetingType && relevantSignals.length > 0) {
    return `Clasifique como ${meetingType.displayName} por estas senales: ${relevantSignals.join(', ')}. Confianza ${confidence.toFixed(2)}.`;
  }
  if (meetingType) {
    return `Clasifique como ${meetingType.displayName} con confianza ${confidence.toFixed(2)} y senales limitadas.`;
  }
  return fallbackReason;
}

export function buildStrategyReasonText(
  meetingType: MeetingTypeDefinition | null,
  relevantSignals: string[],
  fallbackReason: string,
): string {
  if (!meetingType) return fallbackReason;

  const signals = relevantSignals.length > 0 ? ` Senales: ${relevantSignals.join(', ')}.` : '';
  return `La estrategia de ${meetingType.displayName} prioriza ${meetingType.extractionFocus.join(', ')}.${signals}`;
}
