import type {
  MeetingAssetPayload,
  MeetingReviewFlag,
  MeetingReviewFlagCode,
  MeetingSyncActionPayload,
  ProposedMeetingAction,
} from '../meeting-types';

export function buildReviewFlags(
  asset: MeetingAssetPayload,
  proposedActions: ProposedMeetingAction[],
): MeetingReviewFlag[] {
  const flags: MeetingReviewFlag[] = [];
  const shouldEnforceProjectTarget = shouldRouteToProject(asset);
  collectDecisionFlags(asset, flags);
  collectCommitmentFlags(asset, flags, shouldEnforceProjectTarget);
  collectActionFlags(proposedActions, flags);
  return deduplicateFlags(flags);
}

export function getBlockingFlagsForPayload(
  payload: Pick<MeetingSyncActionPayload, 'team_id' | 'project_id' | 'due_date' | 'owner_candidate' | 'assignee_id'>,
): MeetingReviewFlagCode[] {
  const flags: MeetingReviewFlagCode[] = [];
  if (!payload.team_id && !payload.project_id) flags.push('missing_project_target');
  if (!payload.due_date) flags.push('missing_due_date');
  if (!payload.assignee_id && !payload.owner_candidate) flags.push('missing_owner');
  return Array.from(new Set(flags));
}

function collectDecisionFlags(asset: MeetingAssetPayload, flags: MeetingReviewFlag[]): void {
  asset.decisions.forEach((decision, index) => {
    if (!decision.evidence_refs?.length) {
      flags.push(makeFlag('missing_evidence', 'Falta evidencia para una decision.', 'decision', index));
    }
    if (typeof decision.confidence === 'number' && decision.confidence < 0.65) {
      flags.push(makeFlag('low_confidence', 'Hay una decision con baja confianza.', 'decision', index));
    }
  });
}

function collectCommitmentFlags(
  asset: MeetingAssetPayload,
  flags: MeetingReviewFlag[],
  shouldEnforceProjectTarget: boolean,
): void {
  asset.commitments.forEach((commitment, index) => {
    if (!commitment.owner_candidate) flags.push(makeFlag('missing_owner', 'Hay un compromiso sin responsable.', 'action', index));
    if (!commitment.due_date_candidate) flags.push(makeFlag('missing_due_date', 'Hay un compromiso sin fecha compromiso.', 'action', index));
    if (shouldEnforceProjectTarget && !commitment.project_target) {
      flags.push(makeFlag('missing_project_target', 'Hay un compromiso sin proyecto objetivo.', 'action', index));
    }
    if (!commitment.evidence_refs?.length) flags.push(makeFlag('missing_evidence', 'Hay un compromiso sin evidencia.', 'action', index));
    if (typeof commitment.confidence === 'number' && commitment.confidence < 0.65) {
      flags.push(makeFlag('low_confidence', 'Hay un compromiso con baja confianza.', 'action', index));
    }
  });
}

function collectActionFlags(proposedActions: ProposedMeetingAction[], flags: MeetingReviewFlag[]): void {
  const messages: Partial<Record<MeetingReviewFlagCode, string>> = {
    missing_owner: 'La accion necesita responsable antes de sincronizar.',
    missing_due_date: 'La accion necesita fecha antes de sincronizar.',
    missing_project_target: 'La accion necesita proyecto o team valido antes de sincronizar.',
  };
  proposedActions.forEach((action, index) => {
    action.blocking_flags.forEach((code) => {
      const message = messages[code];
      if (message) flags.push(makeFlag(code, message, 'action', index));
    });
  });
}

function shouldRouteToProject(asset: MeetingAssetPayload): boolean {
  const suggestedDestination = asset.analysis_result?.destinationRecommendation.suggestedDestination || 'Project Hub';
  return suggestedDestination === 'IRIS' || suggestedDestination === 'Project Hub' || suggestedDestination === 'Project';
}

function makeFlag(code: MeetingReviewFlagCode, message: string, entityType: MeetingReviewFlag['entity_type'], entityIndex: number): MeetingReviewFlag {
  return { code, message, entity_type: entityType, entity_index: entityIndex };
}

function deduplicateFlags(flags: MeetingReviewFlag[]): MeetingReviewFlag[] {
  const seen = new Set<string>();
  return flags.filter((flag) => {
    const key = `${flag.code}:${flag.entity_type || 'none'}:${flag.entity_index ?? -1}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
