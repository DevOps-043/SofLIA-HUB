import type { ExtractMeetingAssetInput } from './internal-types';
import type { MeetingAnalysisResult, MeetingAssetPayload } from '../meeting-types';
import { DEFAULT_BLOCKED_ACTIONS } from './constants';
import { extractParticipants, getLines, inferTitle } from './text-helpers';
import { buildOperationalSummaryText } from './reason-builders';
import {
  attachEvidence,
  toLegacyCommitment,
  toLegacyDecision,
  toLegacyOpenQuestion,
  toLegacyParkingLot,
  toLegacyRisk,
} from './legacy-mappers';

export function buildMeetingAssetPayload(
  analysis: MeetingAnalysisResult,
  input: ExtractMeetingAssetInput,
): MeetingAssetPayload {
  const lines = getLines(input.sourceArtifact.normalized_text);
  const sourceArtifactId = input.sourceArtifact.id;
  const evidence = [{ source_artifact_id: sourceArtifactId }];
  const continuityContext = [
    ...analysis.tasks.map((task) => `Seguimiento: ${task.description}`),
    ...analysis.openQuestions.map((question) => `Pregunta abierta: ${question.question}`),
    ...analysis.unresolvedItems.map((item) => `Pendiente: ${item.item}`),
  ].slice(0, 8);

  return {
    schema_version: 'meeting_asset.v1',
    meeting_run_id: input.meetingRunId,
    trace_id: input.traceId,
    meeting_title: input.meetingTitle || inferTitle(lines) || 'Reunion sin titulo',
    meeting_type: analysis.meetingType.suggestedType,
    source_refs: [{
      source_artifact_id: sourceArtifactId,
      source_type: input.sourceArtifact.source_type,
      source_uri: input.sourceArtifact.source_uri,
    }],
    participants: extractParticipants(lines),
    decisions: attachEvidence(analysis.decisions.map(toLegacyDecision), evidence),
    commitments: attachEvidence(analysis.tasks.map(toLegacyCommitment), evidence),
    issues: attachEvidence(analysis.risks.map(toLegacyRisk), evidence),
    open_questions: attachEvidence(analysis.openQuestions.map(toLegacyOpenQuestion), evidence),
    parking_lot: attachEvidence(analysis.unresolvedItems.map(toLegacyParkingLot), evidence),
    executive_summary: analysis.executiveSummary,
    operational_summary: buildOperationalSummaryText(analysis),
    review_flags: [],
    proposed_actions: [],
    continuity_context: Array.from(new Set(continuityContext)),
    analysis_result: {
      ...analysis,
      messageDrafts: (analysis.messageDrafts || []).map((draft) => ({
        ...draft,
        requiresApproval: true,
      })),
      governance: {
        autonomyLevelApplied: Math.min(Math.max(analysis.governance.autonomyLevelApplied, 0), 2),
        sensitiveActionsBlocked: analysis.governance.sensitiveActionsBlocked.length > 0
          ? analysis.governance.sensitiveActionsBlocked
          : DEFAULT_BLOCKED_ACTIONS,
        requiresHumanApproval: true,
        explanationVisible: true,
      },
    },
  };
}
