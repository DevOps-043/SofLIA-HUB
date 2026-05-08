import type {
  MeetingAnalysisDestinationRecommendation,
  MeetingAnalysisFollowUpRecommendation,
  MeetingAnalysisMessageDraft,
  MeetingAnalysisRiskItem,
  MeetingAnalysisTaskItem,
} from '../../meeting-types';
import {
  ALLOWED_DESTINATIONS,
  ALLOWED_FOLLOW_UP_TYPES,
  ALLOWED_PRIORITIES,
} from '../constants';

export function normalizePriority(value: unknown): MeetingAnalysisTaskItem['prioritySuggested'] {
  if (typeof value !== 'string') return 'medium';
  const normalized = value.trim().toLowerCase();
  return (ALLOWED_PRIORITIES as readonly string[]).includes(normalized)
    ? (normalized as MeetingAnalysisTaskItem['prioritySuggested'])
    : 'medium';
}

export function normalizeSeverity(value: unknown): MeetingAnalysisRiskItem['severity'] {
  if (typeof value !== 'string') return 'medium';
  const normalized = value.trim().toLowerCase();
  if (normalized === 'critical') return 'critical';
  if (normalized === 'high') return 'high';
  if (normalized === 'low') return 'low';
  return 'medium';
}

export function normalizeFollowUpType(value: unknown): MeetingAnalysisFollowUpRecommendation['type'] | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim().toLowerCase();
  return (ALLOWED_FOLLOW_UP_TYPES as readonly string[]).includes(normalized)
    ? (normalized as MeetingAnalysisFollowUpRecommendation['type'])
    : undefined;
}

export function normalizeDestinationValue(value: unknown): MeetingAnalysisDestinationRecommendation['suggestedDestination'] | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return (ALLOWED_DESTINATIONS as readonly string[]).includes(normalized)
    ? (normalized as MeetingAnalysisDestinationRecommendation['suggestedDestination'])
    : null;
}

export function normalizeMessageKind(value: unknown): MeetingAnalysisMessageDraft['kind'] | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  if (normalized === 'team_summary' || normalized === 'follow_up' || normalized === 'owner_confirmation' || normalized === 'other') {
    return normalized;
  }
  return null;
}

export function inferPriority(line: string): MeetingAnalysisTaskItem['prioritySuggested'] {
  if (/critico|critical|urgente/i.test(line)) return 'critical';
  if (/alto|high|importante/i.test(line)) return 'high';
  if (/bajo|low/i.test(line)) return 'low';
  return 'medium';
}

export function inferSeverity(line: string): MeetingAnalysisRiskItem['severity'] {
  if (/critico|critical/i.test(line)) return 'critical';
  if (/alto|high/i.test(line)) return 'high';
  if (/bajo|low/i.test(line)) return 'low';
  return 'medium';
}
