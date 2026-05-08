import type { MeetingRunDetail } from '../meetings/meeting-types';
import { compactParts, humanizeToken, summarizeList } from './text-utils';

export function resolveMeetingTitle(detail: MeetingRunDetail, fallbackTitle?: string | null): string {
  return detail.run.meeting_title || detail.latest_asset?.payload.meeting_title || fallbackTitle || 'Sin titulo';
}

export function resolveMeetingTypeLabel(detail: MeetingRunDetail): string {
  const analysis = detail.latest_asset?.payload.analysis_result;
  return analysis?.analysisStrategy.strategyName
    || humanizeToken(analysis?.meetingType.suggestedType)
    || humanizeToken(detail.latest_asset?.payload.meeting_type)
    || humanizeToken(detail.run.meeting_type)
    || 'General';
}

export function buildContextLine(detail: MeetingRunDetail): string | null {
  const analysis = detail.latest_asset?.payload.analysis_result;
  const objectives = summarizeList(analysis?.detectedContext.meetingObjective, 2);
  const parts = compactParts([
    analysis?.detectedContext.team ? `equipo ${analysis.detectedContext.team}` : null,
    analysis?.detectedContext.project ? `proyecto ${analysis.detectedContext.project}` : null,
    objectives ? `objetivo ${objectives}` : null,
  ]);
  return parts.length > 0 ? parts.join(' | ') : null;
}

export function buildFocusLine(detail: MeetingRunDetail): string | null {
  const analysis = detail.latest_asset?.payload.analysis_result;
  return summarizeList(analysis?.analysisStrategy.extractionFocus || analysis?.detectedContext.meetingObjective, 3);
}

export function getMeetingExecutiveSummary(detail: MeetingRunDetail): string {
  return detail.latest_asset?.executive_summary?.trim()
    || detail.latest_asset?.payload.executive_summary?.trim()
    || detail.latest_asset?.operational_summary?.trim()
    || detail.latest_asset?.payload.operational_summary?.trim()
    || 'Sin resumen.';
}
