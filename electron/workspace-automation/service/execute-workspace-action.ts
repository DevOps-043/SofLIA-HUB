import {
  createDriveFolderTree,
  normalizeDriveFolderDefinition,
} from '../helpers';
import type {
  DriveFolderDefinition,
  WorkflowActionRecord,
  WorkflowDependencies,
} from '../types';

export async function executeDriveFolderTreeAction(
  deps: WorkflowDependencies,
  action: WorkflowActionRecord,
): Promise<Record<string, any>> {
  const projectName = String(action.payload.projectName || '').trim();
  const parentFolderId = String(action.payload.parentFolderId || '').trim() || undefined;
  const folders = Array.isArray(action.payload.folders)
    ? action.payload.folders
        .map((item) => normalizeDriveFolderDefinition(item))
        .filter((item): item is DriveFolderDefinition => Boolean(item))
    : [];
  if (!projectName || folders.length === 0) throw new Error('La estructura de Drive esta incompleta.');

  const rootResult = await deps.driveService.createFolder(projectName, parentFolderId);
  if (!rootResult.success || !rootResult.folderId) {
    throw new Error(rootResult.error || 'No se pudo crear la carpeta principal en Drive.');
  }

  const createdFolders = await createDriveFolderTree(deps.driveService, rootResult.folderId, folders);
  return { success: true, rootFolderId: rootResult.folderId, folders: createdFolders };
}

export async function executeDesktopTaskAction(
  deps: WorkflowDependencies,
  action: WorkflowActionRecord,
): Promise<Record<string, any>> {
  const backend = typeof action.payload.backend === 'string'
    && ['auto', 'browser', 'desktop', 'uia'].includes(action.payload.backend)
    ? action.payload.backend as 'auto' | 'browser' | 'desktop' | 'uia'
    : undefined;
  const result = await deps.desktopAgentService.executeTask(String(action.payload.task || ''), {
    maxSteps: typeof action.payload.maxSteps === 'number' ? action.payload.maxSteps : undefined,
    backend,
    startUrl: typeof action.payload.startUrl === 'string' ? action.payload.startUrl : undefined,
  });
  return { success: true, message: result };
}
