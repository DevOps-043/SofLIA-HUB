import crypto from 'node:crypto';
import { MeetingAIService } from './meeting-ai-service';
import { MeetingReviewService } from './meeting-review-service';
import { MeetingSourceService } from './meeting-source-service';
import { MeetingStore } from './meeting-store';
import { updateMeetingActionDraft } from './meeting-workflow/action-updater';
import {
  approveMeetingActions,
  approveMeetingAsset,
  refreshMeetingReviewStatus,
  rejectMeetingAction,
} from './meeting-workflow/review-actions';
import { processPreparedMeetingRun } from './meeting-workflow/run-processor';
import type {
  BaseCreateMeetingRunInput,
  CreateDriveMeetingRunInput,
  CreateManualMeetingRunInput,
} from './meeting-workflow/types';
import type {
  CreateMeetingRunResult,
  MeetingFollowupItem,
  MeetingRunDetail,
  MeetingRunSummary,
  PreparedMeetingSource,
  UpdateMeetingActionInput,
} from './meeting-types';

export class MeetingWorkflowService {
  constructor(
    private readonly store: MeetingStore,
    private readonly sourceService: MeetingSourceService,
    private readonly aiService: MeetingAIService,
    private readonly reviewService: MeetingReviewService,
  ) {}

  async init(): Promise<void> { this.store.init(); }

  setApiKey(apiKey: string | null): void { this.aiService.setApiKey(apiKey); }

  async createManualRun(input: CreateManualMeetingRunInput, executionGuard?: () => void): Promise<CreateMeetingRunResult> {
    executionGuard?.();
    const source = await this.sourceService.prepareManualSource({ text: input.text, sourceUri: input.originRef ?? null });
    executionGuard?.();
    return this.createRunFromPreparedSource(input, source, executionGuard);
  }

  async createDriveRun(input: CreateDriveMeetingRunInput): Promise<CreateMeetingRunResult> {
    const source = await this.sourceService.prepareDriveSource({ fileIdOrUrl: input.fileIdOrUrl });
    return this.createRunFromPreparedSource(input, source);
  }

  async listRuns(filters?: { ownerUserId?: string; ownerUserIds?: string[]; organizationId?: string; limit?: number }): Promise<MeetingRunSummary[]> { return this.store.listRuns(filters); }

  async getRunDetail(runId: string): Promise<MeetingRunDetail> {
    const detail = await this.store.getRunDetail(runId);
    if (!detail) throw new Error('No encontre el run solicitado.');
    return detail;
  }

  async approveAsset(runId: string, decidedByUserId: string, comment?: string): Promise<MeetingRunDetail> {
    return approveMeetingAsset(this.store, (id) => this.getRunDetail(id), runId, decidedByUserId, comment);
  }

  async approveActions(runId: string, decidedByUserId: string, actionIds?: string[], comment?: string): Promise<MeetingRunDetail> {
    await this.getRunDetail(runId);
    return approveMeetingActions(this.store, (id) => this.refreshReviewStatus(id), runId, decidedByUserId, actionIds, comment);
  }

  async rejectAction(actionId: string, decidedByUserId: string, comment?: string): Promise<MeetingRunDetail> {
    return rejectMeetingAction(this.store, (id) => this.refreshReviewStatus(id), actionId, decidedByUserId, comment);
  }

  async updateAction(actionId: string, updates: UpdateMeetingActionInput): Promise<MeetingRunDetail> {
    return updateMeetingActionDraft({
      store: this.store,
      reviewService: this.reviewService,
      getRunDetail: (runId) => this.getRunDetail(runId),
    }, actionId, updates);
  }

  async getFollowups(ownerUserId?: string): Promise<MeetingFollowupItem[]> { return this.store.getFollowups(ownerUserId); }

  private async refreshReviewStatus(runId: string): Promise<MeetingRunDetail> {
    return refreshMeetingReviewStatus(this.store, (id) => this.getRunDetail(id), runId);
  }

  private async createRunFromPreparedSource(
    input: BaseCreateMeetingRunInput,
    source: PreparedMeetingSource,
    executionGuard?: () => void,
  ): Promise<CreateMeetingRunResult> {
    return processPreparedMeetingRun({ input, source, store: this.store, aiService: this.aiService, reviewService: this.reviewService, createTraceId: () => crypto.randomUUID(), executionGuard });
  }

}
