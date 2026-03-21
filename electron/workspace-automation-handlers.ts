import { ipcMain } from 'electron';
import type { WorkspaceAutomationService } from './workspace-automation-service';
import { handleIPC } from './utils/ipc-helpers';

export function registerWorkspaceAutomationHandlers(
  workspaceAutomationService: WorkspaceAutomationService,
): void {
  ipcMain.handle('automation:list-templates', () =>
    handleIPC(async () => ({
      templates: workspaceAutomationService.listTemplates(),
    })));

  ipcMain.handle('automation:list-runs', (_event, limit?: number) =>
    handleIPC(async () => ({
      runs: workspaceAutomationService.listRuns(limit),
    })));

  ipcMain.handle('automation:create-custom-template', (_event, input: {
    name?: string | null;
    objective: string;
    requestedBy?: string | null;
  }) =>
    handleIPC(async () => ({
      template: await workspaceAutomationService.createCustomTemplate(input || {}),
    })));

  ipcMain.handle('automation:get-run', (_event, runId: string) =>
    handleIPC(async () => ({
      run: workspaceAutomationService.getRun(String(runId || '').trim()),
    })));

  ipcMain.handle('automation:execute-template', (_event, input: any) =>
    handleIPC(async () => ({
      run: await workspaceAutomationService.executeTemplate(input || {}),
    })));

  ipcMain.handle('automation:approve-run', (_event, input: { runId: string; decidedBy: string; comment?: string | null }) =>
    handleIPC(async () => ({
      run: await workspaceAutomationService.approveRun(
        String(input?.runId || '').trim(),
        String(input?.decidedBy || '').trim(),
        input?.comment || null,
      ),
    })));

  ipcMain.handle('automation:reject-run', (_event, input: { runId: string; decidedBy: string; comment?: string | null }) =>
    handleIPC(async () => ({
      run: workspaceAutomationService.rejectRun(
        String(input?.runId || '').trim(),
        String(input?.decidedBy || '').trim(),
        input?.comment || null,
      ),
    })));

  console.log('[WorkspaceAutomationHandlers] Registered successfully');
}
