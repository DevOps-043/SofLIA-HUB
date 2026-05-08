import type { MeetingAnalysisMessageDraft, MeetingAnalysisResult } from '../meeting-types';
import {
  asConfidence,
  asNullableString,
  asOptionalConfidence,
  asString,
  asStringArray,
  getObject,
  limitStrings,
  normalizeMessageKind,
  normalizePriority,
  normalizeSeverity,
  toIsoDateOrNull,
} from './value-helpers';

export function normalizeDecisions(raw: unknown): MeetingAnalysisResult['decisions'] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      const source = getObject(item);
      return {
        description: asString(source?.description),
        confidence: asConfidence(source?.confidence, 0.65),
        evidence: limitStrings(asStringArray(source?.evidence), 4),
      };
    })
    .filter((item) => item.description);
}

export function normalizeAgreements(raw: unknown): MeetingAnalysisResult['agreements'] {
  return normalizeDecisions(raw).map((item) => ({ ...item }));
}

export function normalizeTasks(raw: unknown): MeetingAnalysisResult['tasks'] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      const source = getObject(item);
      return {
        description: asString(source?.description),
        ownerSuggested: asNullableString(source?.ownerSuggested),
        ownerConfidence: asOptionalConfidence(source?.ownerConfidence),
        dueDateSuggested: toIsoDateOrNull(asNullableString(source?.dueDateSuggested)),
        prioritySuggested: normalizePriority(source?.prioritySuggested),
        reason: asString(source?.reason) || 'Tarea sugerida con base en el contenido de la reunion.',
        confidence: asConfidence(source?.confidence, 0.68),
        requiresHumanReview: true,
        evidence: limitStrings(asStringArray(source?.evidence), 4),
      };
    })
    .filter((task) => task.description);
}

export function normalizeRisks(raw: unknown): MeetingAnalysisResult['risks'] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      const source = getObject(item);
      return {
        description: asString(source?.description),
        severity: normalizeSeverity(source?.severity),
        confidence: asConfidence(source?.confidence, 0.65),
        reason: asString(source?.reason) || undefined,
      };
    })
    .filter((risk) => risk.description);
}

export function normalizeOpenQuestions(raw: unknown): MeetingAnalysisResult['openQuestions'] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      const source = getObject(item);
      return { question: asString(source?.question), confidence: asConfidence(source?.confidence, 0.6) };
    })
    .filter((question) => question.question);
}

export function normalizeMessageDrafts(raw: unknown): MeetingAnalysisMessageDraft[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      const source = getObject(item);
      return { kind: normalizeMessageKind(source?.kind), content: asString(source?.content), requiresApproval: true };
    })
    .filter((draft): draft is MeetingAnalysisMessageDraft => Boolean(draft.kind && draft.content))
    .slice(0, 3);
}
