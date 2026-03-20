import type {
  MeetingAssetPayload,
  MeetingReviewFlag,
  MeetingReviewFlagCode,
  MeetingSyncActionPayload,
  ProposedMeetingAction,
} from './meeting-types';

interface EnrichMeetingAssetInput {
  asset: MeetingAssetPayload;
  defaultTeamId?: string | null;
  defaultProjectId?: string | null;
}

export class MeetingReviewService {
  enrichMeetingAsset(input: EnrichMeetingAssetInput): MeetingAssetPayload {
    const proposedActions = this.buildActions(input.asset, input.defaultTeamId ?? null, input.defaultProjectId ?? null);
    const reviewFlags = this.buildReviewFlags(input.asset, proposedActions);

    return {
      ...input.asset,
      proposed_actions: proposedActions,
      review_flags: reviewFlags,
      continuity_context: Array.from(new Set(input.asset.continuity_context.filter(Boolean))),
    };
  }

  refreshReviewFlags(asset: MeetingAssetPayload): MeetingAssetPayload {
    return {
      ...asset,
      review_flags: this.buildReviewFlags(asset, asset.proposed_actions),
    };
  }

  private buildActions(
    asset: MeetingAssetPayload,
    defaultTeamId: string | null,
    defaultProjectId: string | null,
  ): ProposedMeetingAction[] {
    const analysis = asset.analysis_result;
    const suggestedDestination = analysis?.destinationRecommendation.suggestedDestination || 'Project Hub';
    const shouldCreateSyncDrafts = suggestedDestination === 'IRIS'
      || suggestedDestination === 'Project Hub'
      || suggestedDestination === 'Project';

    if (!shouldCreateSyncDrafts) {
      return [];
    }

    const minimumTaskConfidence = analysis && analysis.meetingType.confidence <= 0.75 ? 0.75 : 0.6;

    return asset.commitments
      .map((commitment, index) => ({
        action_type: 'create_task' as const,
        target_type: 'task_issue' as const,
        summary: commitment.statement,
        payload: {
          title: this.toTaskTitle(commitment.statement),
          description: this.toTaskDescription(
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
        blocking_flags: this.getBlockingFlagsForPayload({
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

  private buildReviewFlags(asset: MeetingAssetPayload, proposedActions: ProposedMeetingAction[]): MeetingReviewFlag[] {
    const flags: MeetingReviewFlag[] = [];
    const suggestedDestination = asset.analysis_result?.destinationRecommendation.suggestedDestination || 'Project Hub';
    const shouldEnforceProjectTarget = suggestedDestination === 'IRIS'
      || suggestedDestination === 'Project Hub'
      || suggestedDestination === 'Project';

    asset.decisions.forEach((decision, index) => {
      if (!decision.evidence_refs?.length) {
        flags.push(this.makeFlag('missing_evidence', 'Falta evidencia para una decision.', 'decision', index));
      }
      if (typeof decision.confidence === 'number' && decision.confidence < 0.65) {
        flags.push(this.makeFlag('low_confidence', 'Hay una decision con baja confianza.', 'decision', index));
      }
    });

    asset.commitments.forEach((commitment, index) => {
      if (!commitment.owner_candidate) {
        flags.push(this.makeFlag('missing_owner', 'Hay un compromiso sin responsable.', 'action', index));
      }
      if (!commitment.due_date_candidate) {
        flags.push(this.makeFlag('missing_due_date', 'Hay un compromiso sin fecha compromiso.', 'action', index));
      }
      if (shouldEnforceProjectTarget && !commitment.project_target) {
        flags.push(this.makeFlag('missing_project_target', 'Hay un compromiso sin proyecto objetivo.', 'action', index));
      }
      if (!commitment.evidence_refs?.length) {
        flags.push(this.makeFlag('missing_evidence', 'Hay un compromiso sin evidencia.', 'action', index));
      }
      if (typeof commitment.confidence === 'number' && commitment.confidence < 0.65) {
        flags.push(this.makeFlag('low_confidence', 'Hay un compromiso con baja confianza.', 'action', index));
      }
    });

    proposedActions.forEach((action, index) => {
      for (const flagCode of action.blocking_flags) {
        if (flagCode === 'missing_owner') {
          flags.push(this.makeFlag(flagCode, 'La accion necesita responsable antes de sincronizar.', 'action', index));
        }
        if (flagCode === 'missing_due_date') {
          flags.push(this.makeFlag(flagCode, 'La accion necesita fecha antes de sincronizar.', 'action', index));
        }
        if (flagCode === 'missing_project_target') {
          flags.push(this.makeFlag(flagCode, 'La accion necesita proyecto o team valido antes de sincronizar.', 'action', index));
        }
      }
    });

    return this.deduplicateFlags(flags);
  }

  getBlockingFlagsForPayload(
    payload: Pick<MeetingSyncActionPayload, 'team_id' | 'project_id' | 'due_date' | 'owner_candidate' | 'assignee_id'>,
  ): MeetingReviewFlagCode[] {
    const flags: MeetingReviewFlagCode[] = [];
    if (!payload.team_id && !payload.project_id) flags.push('missing_project_target');
    if (!payload.due_date) flags.push('missing_due_date');
    if (!payload.assignee_id && !payload.owner_candidate) flags.push('missing_owner');
    return Array.from(new Set(flags));
  }

  private toTaskTitle(statement: string): string {
    return statement.length > 120 ? `${statement.slice(0, 117).trim()}...` : statement.trim();
  }

  private toTaskDescription(
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

  private makeFlag(
    code: MeetingReviewFlagCode,
    message: string,
    entityType: MeetingReviewFlag['entity_type'],
    entityIndex: number,
  ): MeetingReviewFlag {
    return {
      code,
      message,
      entity_type: entityType,
      entity_index: entityIndex,
    };
  }

  private deduplicateFlags(flags: MeetingReviewFlag[]): MeetingReviewFlag[] {
    const seen = new Set<string>();
    const result: MeetingReviewFlag[] = [];
    for (const flag of flags) {
      const key = `${flag.code}:${flag.entity_type || 'none'}:${flag.entity_index ?? -1}`;
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(flag);
    }
    return result;
  }
}
