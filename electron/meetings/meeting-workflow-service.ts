import crypto from 'node:crypto';
import {
  getProjects,
  getTeamMembersDetailed,
  getTeams,
  type IrisTeamMemberDetail,
} from '../iris-data-main';
import { MeetingAIService } from './meeting-ai-service';
import { MeetingAssigneeService } from './meeting-assignee-service';
import { MeetingReviewService } from './meeting-review-service';
import { MeetingSourceService } from './meeting-source-service';
import { MeetingStore } from './meeting-store';
import { MeetingSyncService } from './meeting-sync-service';
import type {
  CreateMeetingRunResult,
  MeetingFollowupItem,
  MeetingOriginChannel,
  MeetingRunDetail,
  MeetingRunSummary,
  MeetingSyncActionPayload,
  MeetingSyncExecutionResult,
  PreparedMeetingSource,
  ProposedMeetingAction,
  UpdateMeetingActionInput,
} from './meeting-types';

interface BaseCreateMeetingRunInput {
  organizationId?: string | null;
  workspaceId?: string | null;
  ownerUserId: string;
  originChannel: MeetingOriginChannel;
  originRef?: string | null;
  meetingTitle?: string | null;
  meetingType?: string;
  meetingSeriesKey?: string | null;
  defaultTeamId?: string | null;
  defaultProjectId?: string | null;
}

interface CreateManualMeetingRunInput extends BaseCreateMeetingRunInput {
  text: string;
}

interface CreateDriveMeetingRunInput extends BaseCreateMeetingRunInput {
  fileIdOrUrl: string;
}

export class MeetingWorkflowService {
  constructor(
    private readonly store: MeetingStore,
    private readonly sourceService: MeetingSourceService,
    private readonly aiService: MeetingAIService,
    private readonly reviewService: MeetingReviewService,
    private readonly syncService: MeetingSyncService,
    private readonly assigneeService = new MeetingAssigneeService(),
  ) {}

  async init(): Promise<void> {
    this.store.init();
  }

  setApiKey(apiKey: string | null): void {
    this.aiService.setApiKey(apiKey);
  }

  async createManualRun(input: CreateManualMeetingRunInput): Promise<CreateMeetingRunResult> {
    const source = await this.sourceService.prepareManualSource({
      text: input.text,
      sourceUri: input.originRef ?? null,
    });

    return this.createRunFromPreparedSource(input, source);
  }

  async createDriveRun(input: CreateDriveMeetingRunInput): Promise<CreateMeetingRunResult> {
    const source = await this.sourceService.prepareDriveSource({
      fileIdOrUrl: input.fileIdOrUrl,
    });

    return this.createRunFromPreparedSource(input, source);
  }

  async listRuns(filters?: { ownerUserId?: string; limit?: number }): Promise<MeetingRunSummary[]> {
    return this.store.listRuns(filters);
  }

  async getRunDetail(runId: string): Promise<MeetingRunDetail> {
    const detail = await this.store.getRunDetail(runId);
    if (!detail) {
      throw new Error('No encontre el run solicitado.');
    }
    return detail;
  }

  async approveAsset(runId: string, decidedByUserId: string, comment?: string): Promise<MeetingRunDetail> {
    await this.getRunDetail(runId);
    await this.store.approveAsset(runId, decidedByUserId, comment);
    return this.getRunDetail(runId);
  }

  async approveActions(runId: string, decidedByUserId: string, actionIds?: string[], comment?: string): Promise<MeetingRunDetail> {
    await this.getRunDetail(runId);
    await this.store.approveActions(runId, decidedByUserId, actionIds, comment);
    return this.refreshReviewStatus(runId);
  }

  async rejectAction(actionId: string, decidedByUserId: string, comment?: string): Promise<MeetingRunDetail> {
    const action = await this.store.rejectAction(actionId, decidedByUserId, comment);
    if (!action) {
      throw new Error('No encontre la accion a rechazar.');
    }
    return this.refreshReviewStatus(action.meeting_run_id);
  }

  async updateAction(actionId: string, updates: UpdateMeetingActionInput): Promise<MeetingRunDetail> {
    const currentAction = await this.store.getAction(actionId);
    if (!currentAction) {
      throw new Error('No encontre la accion a actualizar.');
    }

    const nextPayload = await this.reconcileActionPayload({
      ...currentAction.payload,
      ...(updates.title !== undefined ? { title: updates.title || undefined } : {}),
      ...(updates.description !== undefined ? { description: updates.description || undefined } : {}),
      ...(updates.team_id !== undefined ? { team_id: updates.team_id || undefined } : {}),
      ...(updates.project_id !== undefined ? { project_id: updates.project_id || undefined } : {}),
      ...(updates.due_date !== undefined ? { due_date: updates.due_date || null } : {}),
      ...(updates.owner_candidate !== undefined ? { owner_candidate: updates.owner_candidate || null } : {}),
      ...(updates.assignee_id !== undefined ? { assignee_id: updates.assignee_id || null } : {}),
    });

    const blockingFlags = this.reviewService.getBlockingFlagsForPayload(nextPayload);
    const action = await this.store.updateActionDraft(actionId, {
      ...updates,
      owner_candidate: nextPayload.owner_candidate ?? null,
      assignee_id: nextPayload.assignee_id ?? null,
      summary: updates.summary || updates.title || undefined,
      blockingFlags,
    });

    if (!action) {
      throw new Error('No encontre la accion a actualizar.');
    }

    await this.store.updateRunStatus(action.meeting_run_id, 'REVIEW_REQUIRED', null);
    return this.getRunDetail(action.meeting_run_id);
  }

  async syncApprovedActions(
    runId: string,
    decidedByUserId: string,
  ): Promise<{ detail: MeetingRunDetail; result: MeetingSyncExecutionResult }> {
    await this.store.updateRunStatus(runId, 'SYNCING', null);
    const result = await this.syncService.syncApprovedActions(runId, decidedByUserId);
    const nextStatus = result.failed > 0 && result.synced === 0 ? 'SYNC_FAILED' : result.synced > 0 ? 'SYNCED' : 'APPROVED';
    await this.store.updateRunStatus(
      runId,
      nextStatus,
      result.failed > 0 ? 'Algunas acciones no se pudieron sincronizar.' : null,
    );
    return {
      detail: await this.getRunDetail(runId),
      result,
    };
  }

  async getFollowups(ownerUserId?: string): Promise<MeetingFollowupItem[]> {
    return this.store.getFollowups(ownerUserId);
  }

  async getContext(): Promise<{ teams: any[]; projects: any[]; teamMembers: IrisTeamMemberDetail[] }> {
    const teams = await getTeams();
    const [projects, membersByTeam] = await Promise.all([
      getProjects(),
      Promise.all(teams.map((team) => getTeamMembersDetailed(team.team_id))),
    ]);

    return {
      teams,
      projects,
      teamMembers: membersByTeam.flat(),
    };
  }

  private async refreshReviewStatus(runId: string): Promise<MeetingRunDetail> {
    const detail = await this.getRunDetail(runId);
    const hasDraftActions = detail.sync_actions.some((action) => action.approval_state === 'draft');
    await this.store.updateRunStatus(runId, hasDraftActions ? 'REVIEW_REQUIRED' : 'APPROVED', null);
    return this.getRunDetail(runId);
  }

  private async createRunFromPreparedSource(
    input: BaseCreateMeetingRunInput,
    source: PreparedMeetingSource,
  ): Promise<CreateMeetingRunResult> {
    const existingRun = await this.store.findRunByOwnerAndSourceHash(input.ownerUserId, source.content_hash);
    if (existingRun) {
      const detail = await this.store.getRunDetail(existingRun.id);
      if (detail) {
        return { detail, deduplicated: true };
      }
    }

    const traceId = crypto.randomUUID();
    const sourceVersion = await this.store.getNextSourceVersion(input.ownerUserId, source.source_uri);
    const run = await this.store.createRun({
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

    const sourceArtifact = await this.store.addSourceArtifact(run.id, source);

    try {
      const extraction = await this.aiService.extractMeetingAsset({
        traceId,
        meetingRunId: run.id,
        meetingTitle: input.meetingTitle ?? run.meeting_title,
        meetingType: input.meetingType || run.meeting_type,
        sourceArtifact,
      });

      const reviewedAsset = this.reviewService.enrichMeetingAsset({
        asset: extraction.payload,
        defaultTeamId: input.defaultTeamId,
        defaultProjectId: input.defaultProjectId,
      });

      reviewedAsset.proposed_actions = await this.resolveAssigneesForActions(reviewedAsset.proposed_actions);
      const finalAsset = this.reviewService.refreshReviewFlags(reviewedAsset);

      const asset = await this.store.addAsset(run.id, finalAsset, extraction.confidence);
      await this.store.replaceSyncActions(run.id, asset.id, finalAsset.proposed_actions);
      await this.store.updateRunStatus(run.id, 'REVIEW_REQUIRED', null);

      const detail = await this.store.getRunDetail(run.id);
      if (!detail) {
        throw new Error('No se pudo recuperar el run despues de procesarlo.');
      }
      return { detail, deduplicated: false };
    } catch (error: any) {
      await this.store.updateRunStatus(run.id, 'FAILED_EXTRACTION', error?.message || 'Fallo la extraccion de la reunion.');
      throw error;
    }
  }

  private async resolveAssigneesForActions(actions: ProposedMeetingAction[]): Promise<ProposedMeetingAction[]> {
    if (actions.length === 0) {
      return [];
    }

    return Promise.all(
      actions.map(async (action) => {
        const payload = await this.reconcileActionPayload(action.payload);
        return {
          ...action,
          payload,
          blocking_flags: this.reviewService.getBlockingFlagsForPayload(payload),
        };
      }),
    );
  }

  private async reconcileActionPayload(payload: MeetingSyncActionPayload): Promise<MeetingSyncActionPayload> {
    const nextPayload: MeetingSyncActionPayload = {
      ...payload,
      owner_candidate: payload.owner_candidate ?? null,
      assignee_id: payload.assignee_id ?? null,
      due_date: payload.due_date ?? null,
    };

    if (!nextPayload.team_id) {
      nextPayload.assignee_id = nextPayload.assignee_id ?? null;
      return nextPayload;
    }

    const teamMembers = await getTeamMembersDetailed(nextPayload.team_id);
    const assigneeStillValid = nextPayload.assignee_id
      ? teamMembers.some((member) => member.user_id === nextPayload.assignee_id)
      : false;

    if (nextPayload.assignee_id && !assigneeStillValid) {
      nextPayload.assignee_id = null;
    }

    if (!nextPayload.assignee_id && nextPayload.owner_candidate) {
      nextPayload.assignee_id = this.assigneeService.resolveAssigneeId(nextPayload.owner_candidate, teamMembers);
    }

    return nextPayload;
  }
}
