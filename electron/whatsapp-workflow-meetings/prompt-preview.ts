import type { MeetingRunDetail } from '../meetings/meeting-types';
import { buildFocusLine, resolveMeetingTypeLabel } from './intro-detail';
import { compactParts, stripStrategyPrefix, summarizeList, truncateSentence } from './text-utils';

export function buildPromptPreview(detail: MeetingRunDetail): string[] {
  const analysis = detail.latest_asset?.payload.analysis_result;
  if (!analysis) {
    const fallbackFocus = buildFocusLine(detail);
    return compactParts([fallbackFocus ? `Me enfocare en ${fallbackFocus}.` : null]);
  }

  const focus = summarizeList(analysis.analysisStrategy.extractionFocus, 3);
  return compactParts([
    `La estoy leyendo como ${resolveMeetingTypeLabel(detail)}.`,
    analysis.analysisStrategy.whyThisStrategy
      ? truncateSentence(stripStrategyPrefix(analysis.analysisStrategy.whyThisStrategy), 180)
      : null,
    focus ? `Voy a priorizar ${focus}.` : null,
  ]);
}
