import { ipcMain, type BrowserWindow, type IpcMainInvokeEvent } from 'electron';
import { z } from 'zod';
import { getProjectHubApiService, type ProjectHubApiService, type ProjectHubOperationAuthorization } from './project-hub';
import { nativeConfirmation, trustedAppCaller } from './ipc/caller-authorization';
import { projectHubInputs, projectHubSnapshot } from '../src/shared/project-hub';
import { projectHubMutationReview, projectHubReviewTarget } from './project-hub/ipc-review';
import { createLogger } from './utils/logger';
import { withCorrelation } from './utils/correlation';
import { registerProjectHubUploadHandlers } from './project-hub/upload-handlers';
import { registerProjectHubDownloadHandlers } from './project-hub/download-handlers';
import { ProjectFileOperations } from './project-hub/file-operations';

const log = createLogger('project-hub-ipc');

export function registerProjectHubHandlers(
  service: ProjectHubApiService = getProjectHubApiService(),
  getWindow?: () => BrowserWindow | null,
): void {
  const windows = () => [getWindow?.() ?? null];
  const confirm = nativeConfirmation('Confirmar cambio en Project Hub');
  const register = <T>(channel: string, schema: z.ZodType<T>, label: string | null,
    operation: (input: T, authorization: ProjectHubOperationAuthorization) => unknown | Promise<unknown>, empty = false) => {
    ipcMain.handle(channel, async (event: IpcMainInvokeEvent, ...args: unknown[]) => withCorrelation(async () => {
      let caller: ReturnType<typeof trustedAppCaller> | undefined;
      let invoked = false;
      try {
        caller = trustedAppCaller(event, windows); caller.assert();
        if (!caller.parent || !caller.userId) throw new Error('Contexto no disponible.');
        let input: T;
        try {
          if (args.length !== (empty ? 0 : 1)) throw new Error('Argumentos inválidos.');
          input = schema.parse(empty ? undefined : projectHubSnapshot(args[0]));
        } catch { return { success: false, code: 'INVALID_PAYLOAD', error: 'Solicitud Project Hub inválida o excesiva.' }; }
        const authorization: ProjectHubOperationAuthorization = { userId: caller.userId, assertCurrent: caller.assert, signal: caller.signal };
        if (label) {
          const target = await projectHubReviewTarget(service, input, authorization); caller.assert();
          const detail = projectHubMutationReview(label, caller.userId, input, target);
          if (!await confirm(caller.parent, detail, caller.assert, caller.signal)) {
            return { success: false, code: 'CANCELLED', cancelled: true, error: 'Cambio cancelado.' };
          }
        }
        caller.assert(); invoked = true;
        const result = await operation(input, authorization); caller.assert();
        log.info({ channel, success: Boolean(result && typeof result === 'object' && 'success' in result && result.success === true) }, 'Solicitud Project Hub procesada.');
        if (label && result && typeof result === 'object' && 'success' in result && result.success === false
          && 'code' in result && ['TIMEOUT', 'UNAVAILABLE', 'INVALID_RESPONSE', 'SESSION_CHANGED'].includes(String(result.code))) {
          return { ...result, uncertain: true, recoveryRequired: true };
        }
        return result;
      } catch {
        log.warn({ channel }, 'Solicitud Project Hub rechazada o sin resultado verificable.');
        return { success: false, code: 'IPC_DENIED', error: 'No se pudo completar la operación. Revisa la sesión y la confirmación.',
          ...(invoked && label ? { uncertain: true, recoveryRequired: true } : {}) };
      } finally { caller?.dispose(); }
    }));
  };
  register('project-hub:status', z.undefined(), null, async (_input, auth) => ({ success: true, data: await service.getStatus(auth) }), true);
  register('project-hub:retry-auth', z.undefined(), null, (_input, auth) => service.retryAuthentication(auth), true);
  register('project-hub:list-projects', projectHubInputs.listProjects, null, (input, auth) => service.listProjects(input, auth));
  register('project-hub:create-project', projectHubInputs.createProject, 'Crear proyecto', (input, auth) => service.createProject(input, auth));
  register('project-hub:get-project', projectHubInputs.getProject, null, (input, auth) => service.getProject(input, auth));
  register('project-hub:update-project', projectHubInputs.updateProject, 'Actualizar o archivar proyecto', (input, auth) => service.updateProject(input, auth));
  register('project-hub:list-tasks', projectHubInputs.listTasks, null, (input, auth) => service.listTasks(input, auth));
  register('project-hub:create-task', projectHubInputs.createTask, 'Crear tarea', (input, auth) => service.createTask(input, auth));
  register('project-hub:update-task', projectHubInputs.updateTask, 'Actualizar tarea', (input, auth) => service.updateTask(input, auth));
  register('project-hub:list-members', projectHubInputs.listMembers, null, (input, auth) => service.listMembers(input, auth));
  register('project-hub:add-member', projectHubInputs.addMember, 'Agregar miembro y conceder rol', (input, auth) => service.addMember(input, auth));
  register('project-hub:update-member', projectHubInputs.updateMember, 'Cambiar rol de miembro', (input, auth) => service.updateMember(input, auth));
  register('project-hub:remove-member', projectHubInputs.removeMember, 'Retirar miembro y su acceso', (input, auth) => service.removeMember(input, auth));
  register('project-hub:list-evidence', projectHubInputs.listEvidence, null, (input, auth) => service.listEvidence(input, auth));
  register('project-hub:get-evidence', projectHubInputs.getEvidence, null, (input, auth) => service.getEvidence(input, auth));
  register('project-hub:add-evidence', projectHubInputs.addEvidence, 'Compartir fuente y evidencia', (input, auth) => service.addEvidence(input, auth));
  register('project-hub:get-analytics', projectHubInputs.getAnalytics, null, (input, auth) => service.getAnalytics(input, auth));
  register('project-hub:create-browser-collection', projectHubInputs.createBrowserCollection, 'Compartir investigación y textos de pestañas', (input, auth) => service.createBrowserCollection(input, auth));
  register('project-hub:import-meeting', projectHubInputs.importMeeting, 'Importar reunión, evidencia y tareas', (input, auth) => service.importMeeting(input, auth));
  const files = new ProjectFileOperations();
  registerProjectHubUploadHandlers(service, windows, confirm, files);
  registerProjectHubDownloadHandlers(service, windows, confirm, files);
}
