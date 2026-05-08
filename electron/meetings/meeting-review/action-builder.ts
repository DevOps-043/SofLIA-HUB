import type {
  MeetingAssetPayload,
  ProposedMeetingAction,
} from '../meeting-types';
import { getBlockingFlagsForPayload } from './blocking-flags';

export function buildProposedActions(
  asset: MeetingAssetPayload,
  defaultTeamId: string | null,
  defaultProjectId: string | null,
): ProposedMeetingAction[] {
  const analysis = asset.analysis_result;
  if (!shouldCreateSyncDrafts(asset)) return [];

  const minimumTaskConfidence = analysis && analysis.meetingType.confidence <= 0.75 ? 0.75 : 0.6;
  return asset.commitments
    .map((commitment, index) => ({
      action_type: 'create_task' as const,
      target_type: 'task_issue' as const,
      summary: commitment.statement,
      payload: {
        title: toTaskTitle(commitment.statement),
        description: toTaskDescription(
          asset.meeting_title,
          commitment.statement,
          commitment.owner_candidate,
          asset.source_refs.find((sourceRef) => sourceRef.source_uri)?.source_uri || null,
          analysis?.tasks[index]?.reason,
        ),
        team_id: defaultTeamId || undefined,
        project_id: commitment.project_target || defaultProjectId || undefined,
        due_date: commitment.due_date_candidate || null,
        owner_candidate: commitment.owner_candidate || null,
        source_commitment_index: index,
      },
      requires_approval: true,
      blocking_flags: getBlockingFlagsForPayload({
        team_id: defaultTeamId || undefined,
        project_id: commitment.project_target || defaultProjectId || undefined,
        due_date: commitment.due_date_candidate || null,
        owner_candidate: commitment.owner_candidate || null,
        assignee_id: null,
      }),
    }))
    .filter((action, index) =>
      action.summary.trim().length > 0
      && (asset.commitments[index]?.confidence ?? 0) >= minimumTaskConfidence);
}

function shouldCreateSyncDrafts(asset: MeetingAssetPayload): boolean {
  const suggestedDestination = asset.analysis_result?.destinationRecommendation.suggestedDestination || 'Project Hub';
  return suggestedDestination === 'IRIS' || suggestedDestination === 'Project Hub' || suggestedDestination === 'Project';
}

function toTaskTitle(statement: string): string {
  return statement.length > 120 ? `${statement.slice(0, 117).trim()}...` : statement.trim();
}

function toTaskDescription(
  meetingTitle: string,
  statement: string,
  ownerCandidate?: string | null,
  transcriptSourceUri?: string | null,
  taskReason?: string | null,
): string {
  return [
    'Creado desde Meeting Ops.',
    `Reunion: ${meetingTitle || 'Sin titulo'}.`,
    `Compromiso: ${statement.trim()}.`,
    ownerCandidate ? `Responsable detectado: ${ownerCandidate}.` : null,
    taskReason ? `Razon operativa: ${taskReason}.` : null,
    transcriptSourceUri ? `Transcript de respaldo: ${transcriptSourceUri}` : null,
  ].filter(Boolean).join('\n');
}
