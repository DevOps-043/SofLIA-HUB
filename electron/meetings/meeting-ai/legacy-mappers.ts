import { LOW_CONFIDENCE_TASK_STATE_THRESHOLD } from './constants';
import { toIsoDateOrNull } from './value-helpers';
import type {
  MeetingAnalysisDecisionItem,
  MeetingAnalysisRiskItem,
  MeetingAnalysisResult,
  MeetingAnalysisTaskItem,
  MeetingCommitment,
  MeetingDecision,
  MeetingIssue,
  MeetingOpenQuestion,
  MeetingParkingLotItem,
} from '../meeting-types';

export function toLegacyDecision(decision: MeetingAnalysisDecisionItem): MeetingDecision {
  return {
    statement: decision.description,
    owner_candidate: null,
    approval_state: 'needs_review',
    evidence_refs: (decision.evidence || []).map((evidence) => ({ excerpt: evidence })),
    confidence: decision.confidence,
  };
}

export function toLegacyCommitment(task: MeetingAnalysisTaskItem): MeetingCommitment {
  return {
    statement: task.description,
    owner_candidate: task.ownerSuggested || null,
    due_date_candidate: toIsoDateOrNull(task.dueDateSuggested),
    status: task.confidence < LOW_CONFIDENCE_TASK_STATE_THRESHOLD ? 'needs_clarification' : 'open',
    project_target: null,
    evidence_refs: (task.evidence || []).map((evidence) => ({ excerpt: evidence })),
    confidence: task.confidence,
  };
}

export function toLegacyRisk(risk: MeetingAnalysisRiskItem): MeetingIssue {
  const severity = risk.severity === 'critical' ? 'high' : risk.severity || 'medium';
  return {
    statement: risk.description,
    severity,
    owner_candidate: null,
    evidence_refs: risk.reason ? [{ excerpt: risk.reason }] : [],
    confidence: risk.confidence,
  };
}

export function toLegacyOpenQuestion(question: MeetingAnalysisResult['openQuestions'][number]): MeetingOpenQuestion {
  return { question: question.question, owner_candidate: null, evidence_refs: [] };
}

export function toLegacyParkingLot(item: MeetingAnalysisResult['unresolvedItems'][number]): MeetingParkingLotItem {
  return { statement: `${item.item} (${item.reasonOpen})`, evidence_refs: [] };
}

export function attachEvidence<T extends { evidence_refs?: Array<{ source_artifact_id?: string; excerpt?: string }> }>(
  items: T[],
  fallbackRefs: Array<{ source_artifact_id?: string; excerpt?: string }>,
): T[] {
  return items.map((item) => ({
    ...item,
    evidence_refs: Array.isArray(item.evidence_refs) && item.evidence_refs.length > 0 ? item.evidence_refs : fallbackRefs,
  }));
}
