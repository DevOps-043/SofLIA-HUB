import crypto from 'node:crypto';
import { getTeamMembersDetailed } from '../iris-data-main';
import { MeetingAIService } from './meeting-ai-service';
import { MeetingAssigneeService } from './meeting-assignee-service';
import { MeetingReviewService } from './meeting-review-service';
import { MeetingSourceService } from './meeting-source-service';
import { MeetingStore } from './meeting-store';
import { MeetingSyncService } from './meeting-sync-service';
import { updateMeetingActionDraft } from './meeting-workflow/action-updater';
import { getMeetingWorkflowContext } from './meeting-workflow/context-loader';
import {
  approveMeetingActions,
  approveMeetingAsset,
  refreshMeetingReviewStatus,
  rejectMeetingAction,
} from './meeting-workflow/review-actions';
import { processPreparedMeetingRun } from './meeting-workflow/run-processor';
import { syncApprovedMeetingActions } from './meeting-workflow/sync-actions';
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
  MeetingSyncExecutionResult,
  PreparedMeetingSource,
  UpdateMeetingActionInput,
} from './meeting-types';

export class MeetingWorkflowService {
  constructor(
    private readonly store: MeetingStore,
    private readonly sourceService: MeetingSourceService,
    private readonly aiService: MeetingAIService,
    private readonly reviewService: MeetingReviewService,
    private readonly syncService: MeetingSyncService,
    private readonly assigneeService = new MeetingAssigneeService(),
  ) {}

  async init(): Promise<void> { this.store.init(); }

  setApiKey(apiKey: string | null): void { this.aiService.setApiKey(apiKey); }

  async createManualRun(input: CreateManualMeetingRunInput): Promise<CreateMeetingRunResult> {
    const source = await this.sourceService.prepareManualSource({ text: input.text, sourceUri: input.originRef ?? null });
    return this.createRunFromPreparedSource(input, source);
  }

  async createDriveRun(input: CreateDriveMeetingRunInput): Promise<CreateMeetingRunResult> {
    const source = await this.sourceService.prepareDriveSource({ fileIdOrUrl: input.fileIdOrUrl });
    return this.createRunFromPreparedSource(input, source);
  }

  async listRuns(filters?: { ownerUserId?: string; organizationId?: string; limit?: number }): Promise<MeetingRunSummary[]> { return this.store.listRuns(filters); }

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
      assigneeService: this.assigneeService,
      getTeamMembersDetailed,
      getRunDetail: (runId) => this.getRunDetail(runId),
    }, actionId, updates);
  }

  async syncApprovedActions(runId: string, decidedByUserId: string): Promise<{ detail: MeetingRunDetail; result: MeetingSyncExecutionResult }> {
    return syncApprovedMeetingActions(this.store, this.syncService, (detailRunId) => this.getRunDetail(detailRunId), runId, decidedByUserId);
  }

  async getFollowups(ownerUserId?: string): Promise<MeetingFollowupItem[]> { return this.store.getFollowups(ownerUserId); }

  async getContext() { return getMeetingWorkflowContext(); }

  private async refreshReviewStatus(runId: string): Promise<MeetingRunDetail> {
    return refreshMeetingReviewStatus(this.store, (id) => this.getRunDetail(id), runId);
  }

  private async createRunFromPreparedSource(
    input: BaseCreateMeetingRunInput,
    source: PreparedMeetingSource,
  ): Promise<CreateMeetingRunResult> {
    return processPreparedMeetingRun({ input, source, store: this.store, aiService: this.aiService, reviewService: this.reviewService, assigneeService: this.assigneeService, getTeamMembersDetailed, createTraceId: () => crypto.randomUUID() });
  }

}
