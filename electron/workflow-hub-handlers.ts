import { ipcMain } from 'electron';
import type { WorkflowHubService } from './workflow-hub-service';
import { handleIPC } from './utils/ipc-helpers';

export function registerWorkflowHubHandlers(workflowHubService: WorkflowHubService): void {
  ipcMain.handle('workflow-hub:get-overview', () =>
    handleIPC(async () => ({
      overview: await workflowHubService.getOverview(),
    })));

  ipcMain.handle('workflow-hub:get-case-detail', (_event, caseId: string) =>
    handleIPC(async () => ({
      detail: await workflowHubService.getCaseDetail(String(caseId || '').trim()),
    })));

  ipcMain.handle('workflow-hub:execute-workflow', (_event, input: any) =>
    handleIPC(async () => ({
      detail: await workflowHubService.executeWorkflow(input || {}),
    })));

  ipcMain.handle('workflow-hub:save-variant', (_event, input: any) =>
    handleIPC(async () => ({
      variant: workflowHubService.saveVariant(input || {}),
    })));

  ipcMain.handle('workflow-hub:save-passive-rule', (_event, input: any) =>
    handleIPC(async () => ({
      rule: workflowHubService.savePassiveRule(input || {}),
    })));

  ipcMain.handle('workflow-hub:delete-passive-rule', (_event, ruleId: string) =>
    handleIPC(async () => ({
      deleted: workflowHubService.deletePassiveRule(String(ruleId || '').trim()),
    })));

  ipcMain.handle('workflow-hub:approve-case', (_event, input: any) =>
    handleIPC(async () => ({
      detail: await workflowHubService.approveCase(input || {}),
    })));

  ipcMain.handle('workflow-hub:reject-case', (_event, input: any) =>
    handleIPC(async () => ({
      detail: await workflowHubService.rejectCase(input || {}),
    })));

  ipcMain.handle('workflow-hub:update-case-action', (_event, input: any) =>
    handleIPC(async () => ({
      detail: await workflowHubService.updateCaseAction(input || {}),
    })));

  ipcMain.handle('workflow-hub:sync-case', (_event, input: any) =>
    handleIPC(async () => ({
      detail: await workflowHubService.syncCase(input || {}),
    })));

  console.log('[WorkflowHubHandlers] Registered successfully');
}
