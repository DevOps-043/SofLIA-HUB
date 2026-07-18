import { ipcMain } from 'electron';
import { handleIPC } from './utils/ipc-helpers';
import type { MeetingWorkflowService } from './meetings/meeting-workflow-service';

export function registerMeetingHandlers(meetingWorkflowService: MeetingWorkflowService): void {
  ipcMain.handle('meeting:list-runs', (_event, filters?: { ownerUserId?: string; ownerUserIds?: string[]; organizationId?: string; limit?: number }) =>
    handleIPC(async () => ({
      runs: await meetingWorkflowService.listRuns(filters),
    })));

  ipcMain.handle('meeting:get-run-detail', (_event, runId: string) =>
    handleIPC(async () => ({
      detail: await meetingWorkflowService.getRunDetail(runId),
    })));

  ipcMain.handle('meeting:create-manual-run', (_event, input: any) =>
    handleIPC(async () => ({
      result: await meetingWorkflowService.createManualRun(input),
    })));

  ipcMain.handle('meeting:create-drive-run', (_event, input: any) =>
    handleIPC(async () => ({
      result: await meetingWorkflowService.createDriveRun(input),
    })));

  ipcMain.handle('meeting:approve-asset', (_event, input: { runId: string; decidedByUserId: string; comment?: string }) =>
    handleIPC(async () => ({
      detail: await meetingWorkflowService.approveAsset(input.runId, input.decidedByUserId, input.comment),
    })));

  ipcMain.handle('meeting:approve-actions', (_event, input: { runId: string; decidedByUserId: string; actionIds?: string[]; comment?: string }) =>
    handleIPC(async () => ({
      detail: await meetingWorkflowService.approveActions(input.runId, input.decidedByUserId, input.actionIds, input.comment),
    })));

  ipcMain.handle('meeting:update-action', (_event, input: { actionId: string; updates: any }) =>
    handleIPC(async () => ({
      detail: await meetingWorkflowService.updateAction(input.actionId, input.updates),
    })));

  ipcMain.handle('meeting:reject-action', (_event, input: { actionId: string; decidedByUserId: string; comment?: string }) =>
    handleIPC(async () => ({
      detail: await meetingWorkflowService.rejectAction(input.actionId, input.decidedByUserId, input.comment),
    })));

  ipcMain.handle('meeting:sync-approved-actions', (_event, input: { runId: string; decidedByUserId: string }) =>
    handleIPC(async () => meetingWorkflowService.syncApprovedActions(input.runId, input.decidedByUserId)));

  ipcMain.handle('meeting:get-followups', (_event, ownerUserId?: string) =>
    handleIPC(async () => ({
      followups: await meetingWorkflowService.getFollowups(ownerUserId),
    })));

  ipcMain.handle('meeting:get-context', () =>
    handleIPC(async () => meetingWorkflowService.getContext()));

  console.log('[MeetingHandlers] Registered successfully');
}

