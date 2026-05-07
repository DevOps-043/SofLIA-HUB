/**
 * Helpers puros de normalización para el Workflow Hub.
 *
 * Mapeo de estados nativos (de workspace-automation, meetings) → status
 * canónico unificado, plus utilidades de validación de input.
 *
 * Funciones puras — sin acceso a `this`, testeables aisladamente.
 */

import type {
  WorkflowCaseAction,
  WorkflowCaseStatus,
  WorkflowEngine,
  WorkflowId,
} from './types';
import { AUTOMATION_CASE_PREFIX, MEETING_CASE_PREFIX, WORKFLOW_DEFINITIONS } from './definitions';

export function isWorkflowId(value: string): value is WorkflowId {
  return WORKFLOW_DEFINITIONS.some((workflow) => workflow.id === value);
}

/** Mapea estado del WorkspaceAutomation → status canónico del Hub. */
export function normalizeAutomationStatus(status: string): WorkflowCaseStatus {
  switch (status) {
    case 'needs_approval':
      return 'pending_approval';
    case 'completed':
      return 'completed';
    case 'failed':
      return 'failed';
    case 'rejected':
    case 'cancelled':
    default:
      return 'attention';
  }
}

/** Mapea estado del MeetingWorkflow → status canónico del Hub. */
export function normalizeMeetingStatus(status: string): WorkflowCaseStatus {
  switch (status) {
    case 'REVIEW_REQUIRED':
      return 'pending_approval';
    case 'SOURCE_IMPORTED':
    case 'EXTRACTING':
    case 'SYNCING':
    case 'APPROVED':
    case 'FOLLOWUP_ACTIVE':
      return 'in_progress';
    case 'SYNCED':
    case 'CLOSED':
      return 'completed';
    case 'FAILED_IMPORT':
    case 'FAILED_EXTRACTION':
    case 'SYNC_FAILED':
      return 'failed';
    case 'BLOCKED_REVIEW':
    default:
      return 'attention';
  }
}

/**
 * Combina approval state + sync state + error en un single status para UI.
 * El error message manda — si hubo error, queda como 'failed' aunque haya
 * sido aprobada y sincronizada.
 */
export function normalizeMeetingActionStatus(
  approvalState: string,
  syncState: string,
  errorMessage: string | null,
): WorkflowCaseAction['status'] {
  if (errorMessage || syncState === 'failed') {
    return 'failed';
  }
  if (syncState === 'synced') {
    return 'executed';
  }
  if (approvalState === 'approved') {
    return 'approved';
  }
  if (approvalState === 'rejected') {
    return 'skipped';
  }
  return 'pending';
}

export function normalizeOptionalString(value: unknown): string | null {
  const normalized = String(value || '').trim();
  return normalized || null;
}

export function normalizeEnum(value: unknown, allowed: string[], fallback: string): string {
  const normalized = String(value || '').trim();
  return allowed.includes(normalized) ? normalized : fallback;
}

export function normalizeNumber(
  value: unknown,
  fallback: number,
  min: number,
  max: number,
): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.max(min, Math.min(max, Math.round(parsed)));
}

export function requireNonEmptyString(value: unknown, errorMessage: string): string {
  const normalized = normalizeOptionalString(value);
  if (!normalized) {
    throw new Error(errorMessage);
  }
  return normalized;
}

/**
 * Algunos requestedBy llegan con prefijo de canal ("app:", "whatsapp:",
 * "telegram:") — lo quitamos para obtener el userId limpio.
 */
export function resolveOwnerUserId(requestedBy: string | null): string {
  const normalized = String(requestedBy || '').trim();
  if (!normalized) {
    throw new Error('Necesito un usuario solicitante para crear el caso de reunion.');
  }
  if (normalized.startsWith('app:')) return normalized.slice(4);
  if (normalized.startsWith('whatsapp:')) return normalized.slice(9);
  if (normalized.startsWith('telegram:')) return normalized.slice(9);
  return normalized;
}

/**
 * Convierte una expresión cron de 5 campos a una descripción humana en
 * español (ej. "Lunes a viernes a las 09:00").
 */
export function describeCron(cronExpression: string): string {
  const normalized = String(cronExpression || '').trim();
  const parts = normalized.split(/\s+/);
  if (parts.length !== 5) {
    return normalized;
  }

  const [minuteRaw, hourRaw, , , dayOfWeekRaw] = parts;
  const minute = Number(minuteRaw);
  const hour = Number(hourRaw);
  const timeLabel = Number.isFinite(hour) && Number.isFinite(minute)
    ? `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
    : `${hourRaw}:${minuteRaw}`;

  if (dayOfWeekRaw === '1-5') {
    return `Lunes a viernes a las ${timeLabel}`;
  }
  if (dayOfWeekRaw === '*') {
    return `Todos los dias a las ${timeLabel}`;
  }

  const weekdayMap: Record<string, string> = {
    '0': 'Domingo',
    '1': 'Lunes',
    '2': 'Martes',
    '3': 'Miercoles',
    '4': 'Jueves',
    '5': 'Viernes',
    '6': 'Sabado',
    '7': 'Domingo',
  };
  return `${weekdayMap[dayOfWeekRaw] || normalized} a las ${timeLabel}`;
}

/** Parse del caseId compuesto: `automation:xxx` o `meeting:xxx`. */
export function parseCaseId(caseId: string): { engine: WorkflowEngine; nativeId: string } {
  if (caseId.startsWith(AUTOMATION_CASE_PREFIX)) {
    return { engine: 'automation', nativeId: caseId.slice(AUTOMATION_CASE_PREFIX.length) };
  }
  if (caseId.startsWith(MEETING_CASE_PREFIX)) {
    return { engine: 'meeting', nativeId: caseId.slice(MEETING_CASE_PREFIX.length) };
  }
  throw new Error('No reconoci el caso solicitado.');
}
