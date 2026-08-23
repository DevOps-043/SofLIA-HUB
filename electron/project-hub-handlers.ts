import { ipcMain, type BrowserWindow, type IpcMainInvokeEvent } from 'electron';
import { z } from 'zod';
import { getProjectHubApiService, type ProjectHubApiService } from './project-hub';

const uuid = z.string().uuid();
const projectTarget = z.object({ workspaceId: uuid, projectId: uuid });
const record = z.record(z.string(), z.unknown());

export function registerProjectHubHandlers(
  service: ProjectHubApiService = getProjectHubApiService(),
  getWindow?: () => BrowserWindow | null,
): void {
  const register = <T>(channel: string, schema: z.ZodType<T>, action: (input: T) => unknown) => {
    ipcMain.handle(channel, async (event, payload: unknown) => {
      try {
        assertSender(event, getWindow);
        const parsed = schema.safeParse(payload);
        if (!parsed.success) return { success: false, code: 'INVALID_PAYLOAD', error: 'Solicitud inválida.' };
        return await action(parsed.data);
      } catch {
        return { success: false, code: 'IPC_DENIED', error: 'Solicitud no autorizada.' };
      }
    });
  };

  ipcMain.handle('project-hub:status', async (event) => {
    try { assertSender(event, getWindow); return { success: true, data: await service.getStatus() }; }
    catch { return { success: false, code: 'IPC_DENIED', error: 'Solicitud no autorizada.' }; }
  });
  ipcMain.handle('project-hub:retry-auth', async (event) => {
    try { assertSender(event, getWindow); return await service.retryAuthentication(); }
    catch { return { success: false, code: 'IPC_DENIED', error: 'Solicitud no autorizada.' }; }
  });
  register('project-hub:list-projects', z.object({ workspaceId: uuid, search: z.string().max(255).optional(), cursor: z.string().max(2_000).optional() }), (input) => service.listProjects(input));
  register('project-hub:create-project', z.object({ workspaceId: uuid, project: record }), (input) => service.createProject(input));
  register('project-hub:get-project', projectTarget, (input) => service.getProject(input));
  register('project-hub:update-project', projectTarget.extend({ updates: record }), (input) => service.updateProject(input));
  register('project-hub:list-tasks', projectTarget, (input) => service.listTasks(input));
  register('project-hub:create-task', projectTarget.extend({ task: record }), (input) => service.createTask(input));
  register('project-hub:update-task', projectTarget.extend({ taskId: uuid, updates: record }), (input) => service.updateTask(input));
  register('project-hub:list-members', projectTarget, (input) => service.listMembers(input));
  register('project-hub:add-member', projectTarget.extend({ userId: uuid, role: z.enum(['owner', 'admin', 'member', 'viewer', 'guest']) }), (input) => service.addMember(input));
  register('project-hub:update-member', projectTarget.extend({ memberId: uuid, role: z.enum(['owner', 'admin', 'member', 'viewer', 'guest']) }), (input) => service.updateMember(input));
  register('project-hub:remove-member', projectTarget.extend({ memberId: uuid }), (input) => service.removeMember(input));
  register('project-hub:list-evidence', projectTarget, (input) => service.listEvidence(input));
  register('project-hub:get-evidence', projectTarget.extend({ evidenceId: uuid }), (input) => service.getEvidence(input));
  register('project-hub:add-evidence', projectTarget.extend({ evidence: record }), (input) => service.addEvidence(input));
  register('project-hub:get-analytics', projectTarget, (input) => service.getAnalytics(input));
  register('project-hub:create-browser-collection', projectTarget.extend({ collection: record }), (input) => service.createBrowserCollection(input));
  register('project-hub:import-meeting', projectTarget.extend({ idempotencyKey: z.string().min(8).max(200), meeting: record }), (input) => service.importMeeting(input));
  register('project-hub:create-upload-intent', projectTarget.extend({ files: z.array(record).min(1).max(10) }), (input) => service.createUploadIntent(input));
  register('project-hub:complete-upload', projectTarget.extend({ evidenceId: uuid }), (input) => service.completeUpload(input));
  register('project-hub:get-download', projectTarget.extend({ evidenceId: uuid }), (input) => service.getDownload(input));
}

function assertSender(event: IpcMainInvokeEvent, getWindow?: () => BrowserWindow | null): void {
  const win = getWindow?.();
  if (win && event.sender.id !== win.webContents.id) throw new Error('Sender IPC no autorizado');
}
