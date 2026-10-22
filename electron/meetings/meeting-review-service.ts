import type {
  MeetingAssetPayload,
  MeetingReviewFlagCode,
  MeetingSyncActionPayload,
} from './meeting-types';
import {
  buildReviewFlags,
  getBlockingFlagsForPayload,
} from './meeting-review/blocking-flags';

interface EnrichMeetingAssetInput {
  asset: MeetingAssetPayload;
}

export class MeetingReviewService {
  enrichMeetingAsset(input: EnrichMeetingAssetInput): MeetingAssetPayload {
    // La publicación externa está retirada; los compromisos siguen en la minuta.
    const proposedActions: MeetingAssetPayload['proposed_actions'] = [];

    return {
      ...input.asset,
      proposed_actions: proposedActions,
      review_flags: buildReviewFlags(input.asset, proposedActions),
      continuity_context: Array.from(new Set(input.asset.continuity_context.filter(Boolean))),
    };
  }

  refreshReviewFlags(asset: MeetingAssetPayload): MeetingAssetPayload {
    return {
      ...asset,
      review_flags: buildReviewFlags(asset, asset.proposed_actions),
    };
  }

  getBlockingFlagsForPayload(
    payload: Pick<MeetingSyncActionPayload, 'team_id' | 'project_id' | 'due_date' | 'owner_candidate' | 'assignee_id'>,
  ): MeetingReviewFlagCode[] {
    return getBlockingFlagsForPayload(payload);
  }
}
