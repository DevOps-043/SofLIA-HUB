import type { MeetingRunDetail } from '../meeting-service';
import type {
  WorkflowCapabilityKey,
  WorkflowCaseStatus,
  WorkflowId,
} from './core';

export interface WorkflowCaseAction {
  id: string;
  title: string;
  kind: string;
  status: 'pending' | 'approved' | 'executed' | 'failed' | 'skipped';
  payload: Record<string, unknown>;
  error?: string | null;
  blockingFlags?: string[];
  approvalState?: string | null;
  syncState?: string | null;
}

export interface WorkflowCaseSummary {
  id: string;
  nativeId: string;
  workflowId: WorkflowId;
  workflowName: string;
  engine: 'automation' | 'meeting';
  title: string;
  summary: string;
  normalizedStatus: WorkflowCaseStatus;
  nativeStatus: string;
  createdAt: string;
  updatedAt: string;
  actions: {
    pending: number;
    approved: number;
    failed: number;
    total: number;
  };
  reasons: string[];
}

export interface WorkflowCaseDetail extends WorkflowCaseSummary {
  preview: Record<string, unknown>;
  approvals: Array<Record<string, unknown>>;
  logs: Array<{ at: string; level: string; message: string }>;
  actionsDetail: WorkflowCaseAction[];
  capabilitiesUsed: WorkflowCapabilityKey[];
  automationRun?: Record<string, unknown>;
  meetingDetail?: MeetingRunDetail;
}
