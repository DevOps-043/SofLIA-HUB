/**
 * Helpers de validación y normalización de valores.
 *
 * Todas son funciones puras — sin acceso a `this`, sin efectos secundarios.
 * Se extrajeron de la clase `MeetingAIService` para que sean testeables en
 * aislamiento y reusables por otros módulos del paquete.
 */

import type {
  MeetingAnalysisDestinationRecommendation,
  MeetingAnalysisFollowUpRecommendation,
  MeetingAnalysisMessageDraft,
  MeetingAnalysisRiskItem,
  MeetingAnalysisTaskItem,
} from '../meeting-types';
import {
  ALLOWED_DESTINATIONS,
  ALLOWED_FOLLOW_UP_TYPES,
  ALLOWED_PRIORITIES,
} from './constants';

/* ─── Type guards y conversores ─────────────────────────────────── */

export function getObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function asNullableString(value: unknown): string | null {
  const next = asString(value);
  return next || null;
}

export function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => asString(item)).filter(Boolean);
}

export function limitStrings(values: string[], limit: number): string[] {
  return values.filter(Boolean).slice(0, limit);
}

export function normalizeStringItems(value: unknown): string[] {
  return limitStrings(asStringArray(value), 8);
}

/* ─── Números y confianza ───────────────────────────────────────── */

export function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function asConfidence(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return clampNumber(fallback, 0, 1);
  }
  return clampNumber(value, 0, 1);
}

export function asOptionalConfidence(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }
  return clampNumber(value, 0, 1);
}

/* ─── Texto y fechas ─────────────────────────────────────────────── */

export function normalizeText(value: string): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^\w\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function toIsoDateOrNull(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : null;
}

/* ─── Normalizadores de enum (validan contra ALLOWED_*) ──────────── */

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

export function normalizeFollowUpType(
  value: unknown,
): MeetingAnalysisFollowUpRecommendation['type'] | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim().toLowerCase();
  return (ALLOWED_FOLLOW_UP_TYPES as readonly string[]).includes(normalized)
    ? (normalized as MeetingAnalysisFollowUpRecommendation['type'])
    : undefined;
}

export function normalizeDestinationValue(
  value: unknown,
): MeetingAnalysisDestinationRecommendation['suggestedDestination'] | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return (ALLOWED_DESTINATIONS as readonly string[]).includes(normalized)
    ? (normalized as MeetingAnalysisDestinationRecommendation['suggestedDestination'])
    : null;
}

export function normalizeMessageKind(
  value: unknown,
): MeetingAnalysisMessageDraft['kind'] | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  if (
    normalized === 'team_summary' ||
    normalized === 'follow_up' ||
    normalized === 'owner_confirmation' ||
    normalized === 'other'
  ) {
    return normalized;
  }
  return null;
}

/* ─── Inferencias heurísticas desde texto libre ──────────────────── */

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

/* ─── Parser JSON tolerante a markdown fences ────────────────────── */

export function parseJson<T>(rawText: string): T {
  const normalized = rawText
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```$/, '');
  return JSON.parse(normalized) as T;
}
