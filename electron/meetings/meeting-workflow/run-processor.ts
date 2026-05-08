import type { getTeamMembersDetailed } from '../../iris-data-main';
import type { MeetingAIService } from '../meeting-ai-service';
import type { MeetingAssigneeService } from '../meeting-assignee-service';
import type { MeetingReviewService } from '../meeting-review-service';
import type { MeetingStore } from '../meeting-store';
import type { CreateMeetingRunResult, PreparedMeetingSource } from '../meeting-types';
import { resolveAssigneesForActions } from './assignee-reconciliation';
import type { BaseCreateMeetingRunInput } from './types';

interface ProcessorDeps {
  input: BaseCreateMeetingRunInput;
  source: PreparedMeetingSource;
  store: MeetingStore;
  aiService: MeetingAIService;
  reviewService: MeetingReviewService;
  assigneeService: MeetingAssigneeService;
  getTeamMembersDetailed: typeof getTeamMembersDetailed;
  createTraceId: () => string;
}

export async function processPreparedMeetingRun(deps: ProcessorDeps): Promise<CreateMeetingRunResult> {
  const { input, source, store } = deps;
  const existingRun = await store.findRunByOwnerAndSourceHash(input.ownerUserId, source.content_hash);
  if (existingRun) {
    const detail = await store.getRunDetail(existingRun.id);
    if (detail) return { detail, deduplicated: true };
  }

  const traceId = deps.createTraceId();
  const sourceVersion = await store.getNextSourceVersion(input.ownerUserId, source.source_uri);
  const run = await store.createRun({
    organizationId: input.organizationId,
    workspaceId: input.workspaceId,
    ownerUserId: input.ownerUserId,
    originChannel: input.originChannel,
    originRef: input.originRef,
    meetingTitle: input.meetingTitle,
    meetingType: input.meetingType,
    meetingSeriesKey: input.meetingSeriesKey,
    defaultTeamId: input.defaultTeamId,
    defaultProjectId: input.defaultProjectId,
    source,
    traceId,
    sourceVersion,
  });

  try {
    return await extractAndPersistMeetingRun(deps, run, traceId);
  } catch (error: any) {
    await store.updateRunStatus(run.id, 'FAILED_EXTRACTION', error?.message || 'Fallo la extraccion de la reunion.');
    throw error;
  }
}

async function extractAndPersistMeetingRun(deps: ProcessorDeps, run: any, traceId: string): Promise<CreateMeetingRunResult> {
  const sourceArtifact = await deps.store.addSourceArtifact(run.id, deps.source);
  const extraction = await deps.aiService.extractMeetingAsset({
    traceId,
    meetingRunId: run.id,
    meetingTitle: deps.input.meetingTitle ?? run.meeting_title,
    meetingType: deps.input.meetingType || run.meeting_type,
    sourceArtifact,
  });
  const reviewedAsset = deps.reviewService.enrichMeetingAsset({
    asset: extraction.payload,
    defaultTeamId: deps.input.defaultTeamId,
    defaultProjectId: deps.input.defaultProjectId,
  });
  reviewedAsset.proposed_actions = await resolveAssigneesForActions(deps, reviewedAsset.proposed_actions);
  const finalAsset = deps.reviewService.refreshReviewFlags(reviewedAsset);

  await deps.store.updateRunClassification(run.id, {
    meetingTitle: finalAsset.meeting_title || run.meeting_title,
    meetingType: finalAsset.analysis_result?.meetingType.suggestedType || finalAsset.meeting_type,
  });

  const asset = await deps.store.addAsset(run.id, finalAsset, extraction.confidence);
  await deps.store.replaceSyncActions(run.id, asset.id, finalAsset.proposed_actions);
  await deps.store.updateRunStatus(run.id, 'REVIEW_REQUIRED', null);
  const detail = await deps.store.getRunDetail(run.id);
  if (!detail) throw new Error('No se pudo recuperar el run despues de procesarlo.');
  return { detail, deduplicated: false };
}
