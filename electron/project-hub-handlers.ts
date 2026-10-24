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
          && 'code' in result && (['TIMEOUT', 'UNAVAILABLE', 'INVALID_RESPONSE', 'SESSION_CHANGED'].includes(String(result.code)) || /^HTTP_5\d\d$/.test(String(result.code)))) {
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
  register('project-hub:get-task-options', projectHubInputs.getTaskOptions, null, (input, auth) => service.getTaskOptions(input, auth));
  register('project-hub:archive-task', projectHubInputs.archiveTask, 'Archivar tarea', (input, auth) => service.archiveTask(input, auth));
  register('project-hub:list-milestones', projectHubInputs.listMilestones, null, (input, auth) => service.listMilestones(input, auth));
  register('project-hub:create-milestone', projectHubInputs.createMilestone, 'Crear hito', (input, auth) => service.createMilestone(input, auth));
  register('project-hub:update-milestone', projectHubInputs.updateMilestone, 'Actualizar hito', (input, auth) => service.updateMilestone(input, auth));
  register('project-hub:cancel-milestone', projectHubInputs.cancelMilestone, 'Cancelar hito', (input, auth) => service.cancelMilestone(input, auth));
  register('project-hub:get-project-team', projectHubInputs.getProjectTeam, null, (input, auth) => service.getProjectTeam(input, auth));
  register('project-hub:assign-project-team', projectHubInputs.assignProjectTeam, 'Asignar equipo al proyecto', (input, auth) => service.assignProjectTeam(input, auth));
  register('project-hub:create-project-team', projectHubInputs.createProjectTeam, 'Crear equipo en el espacio de trabajo', (input, auth) => service.createProjectTeam(input, auth));
  register('project-hub:update-project-team', projectHubInputs.updateProjectTeam, 'Actualizar equipo', (input, auth) => service.updateProjectTeam(input, auth));
  register('project-hub:add-team-member', projectHubInputs.addTeamMember, 'Añadir integrante al equipo', (input, auth) => service.addTeamMember(input, auth));
  register('project-hub:update-team-member', projectHubInputs.updateTeamMember, 'Cambiar rol del integrante', (input, auth) => service.updateTeamMember(input, auth));
  register('project-hub:remove-team-member', projectHubInputs.removeTeamMember, 'Retirar integrante del equipo', (input, auth) => service.removeTeamMember(input, auth));
  register('project-hub:list-documents', projectHubInputs.listDocuments, null, (input, auth) => service.listDocuments(input, auth));
  register('project-hub:create-document', projectHubInputs.createDocument, 'Vincular documento al proyecto', (input, auth) => service.createDocument(input, auth));
  register('project-hub:update-document', projectHubInputs.updateDocument, 'Actualizar documento vinculado', (input, auth) => service.updateDocument(input, auth));
  register('project-hub:remove-document', projectHubInputs.removeDocument, 'Desvincular documento sin borrar el original', (input, auth) => service.removeDocument(input, auth));
  register('project-hub:update-evidence', projectHubInputs.updateEvidence, 'Actualizar datos del archivo', (input, auth) => service.updateEvidence(input, auth));
  register('project-hub:archive-evidence', projectHubInputs.archiveEvidence, 'Retirar archivo del proyecto sin borrar el original', (input, auth) => service.archiveEvidence(input, auth));
  register('project-hub:get-task-detail', projectHubInputs.getTaskDetail, null, (input, auth) => service.getTaskDetail(input, auth));
  register('project-hub:add-task-comment', projectHubInputs.addTaskComment, "Publicar comentario en la tarea", (input, auth) => service.addTaskComment(input, auth));
  register('project-hub:list-task-documents', projectHubInputs.listTaskDocuments, null, (input, auth) => service.listTaskDocuments(input, auth));
  register('project-hub:create-task-document', projectHubInputs.createTaskDocument, "Vincular documento a la tarea", (input, auth) => service.createTaskDocument(input, auth));
  register('project-hub:update-task-document', projectHubInputs.updateTaskDocument, "Actualizar documento de la tarea", (input, auth) => service.updateTaskDocument(input, auth));
  register('project-hub:remove-task-document', projectHubInputs.removeTaskDocument, "Desvincular documento de la tarea sin borrar el original", (input, auth) => service.removeTaskDocument(input, auth));
  register('project-hub:create-task-label', projectHubInputs.createTaskLabel, "Crear etiqueta para el equipo del proyecto", (input, auth) => service.createTaskLabel(input, auth));
  const files = new ProjectFileOperations();
  registerProjectHubUploadHandlers(service, windows, confirm, files);
  registerProjectHubDownloadHandlers(service, windows, confirm, files);
}
