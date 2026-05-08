import { ACTION_KIND_LABELS, ACTION_STATUS_LABELS, FIELD_LABELS, RUN_STATUS_LABELS, TEMPLATE_LABELS, TRIAGE_PRESETS } from './constants';
import type { TriagePresetId } from './types';

export function badgeTone(value: string, map: Record<string, string>): string {
  return map[value] || 'bg-gray-500/15 text-gray-500 dark:text-gray-400 border-gray-500/20';
}

export function prettyStatus(value: string): string {
  return RUN_STATUS_LABELS[value] || ACTION_STATUS_LABELS[value] || value.replace(/_/g, ' ');
}

export function formatDateTime(value?: string | null): string {
  if (!value) return 'n/d';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('es-MX', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function previewValue(value: unknown): string {
  if (Array.isArray(value)) return value.map((item) => previewValue(item)).join(', ');
  if (value && typeof value === 'object') return JSON.stringify(value);
  if (value === null || value === undefined || value === '') return 'n/d';
  return String(value);
}

export function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function prettyTemplateId(value: string): string {
  return value.startsWith('custom_') ? 'Flujo propio' : TEMPLATE_LABELS[value] || value.replace(/_/g, ' ');
}

export function prettyActionKind(value: string): string {
  return ACTION_KIND_LABELS[value] || value.replace(/_/g, ' ');
}

export function prettyFieldLabel(value: string): string {
  return FIELD_LABELS[value] || value.replace(/_/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2');
}

export function getEffectiveTriageQuery(preset: TriagePresetId, query: string): string {
  if (preset === 'custom') {
    return query.trim() || TRIAGE_PRESETS.find((item) => item.id === 'custom')?.query || 'in:inbox newer_than:7d';
  }
  return TRIAGE_PRESETS.find((item) => item.id === preset)?.query || 'in:inbox newer_than:7d';
}
