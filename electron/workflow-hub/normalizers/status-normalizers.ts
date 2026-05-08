import type { WorkflowCaseAction, WorkflowCaseStatus } from '../types';

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

export function normalizeMeetingActionStatus(
  approvalState: string,
  syncState: string,
  errorMessage: string | null,
): WorkflowCaseAction['status'] {
  if (errorMessage || syncState === 'failed') return 'failed';
  if (syncState === 'synced') return 'executed';
  if (approvalState === 'approved') return 'approved';
  if (approvalState === 'rejected') return 'skipped';
  return 'pending';
}
