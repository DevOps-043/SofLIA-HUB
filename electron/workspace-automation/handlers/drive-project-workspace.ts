import crypto from 'node:crypto';
import type { DriveFolderDefinition, ExecuteTemplateInput, WorkflowActionRecord, WorkflowRunRecord } from '../types';
import {
  buildDriveWorkspaceFolders,
  normalizeDriveFolderDefinition,
} from '../helpers';
import type { WorkspaceTemplateHandlerContext } from './types';

export async function executeDriveProjectWorkspace(
  payload: ExecuteTemplateInput,
  context: WorkspaceTemplateHandlerContext,
): Promise<WorkflowRunRecord> {
  const projectName = String(payload.input?.projectName || '').trim();
  const parentFolderId = String(payload.input?.parentFolderId || '').trim();
  const gchatSpace = String(payload.input?.gchatSpace || '').trim();
  const requestedFolders = Array.isArray(payload.input?.folders)
    ? payload.input?.folders
        .map((folder) => normalizeDriveFolderDefinition(folder))
        .filter((folder): folder is DriveFolderDefinition => Boolean(folder))
    : [];

  if (!projectName) {
    throw new Error('Necesito el nombre del proyecto o cliente para crear el espacio en Drive.');
  }

  const folders = requestedFolders.length > 0 ? requestedFolders : buildDriveWorkspaceFolders();
  const actions: WorkflowActionRecord[] = [{
    id: crypto.randomUUID(),
    kind: 'drive_folder_tree',
    title: 'Crear estructura base en Google Drive',
    status: 'pending',
    payload: {
      projectName,
      parentFolderId: parentFolderId || undefined,
      folders,
    },
  }];

  if (gchatSpace) {
    actions.push({
      id: crypto.randomUUID(),
      kind: 'gchat_message',
      title: 'Avisar al equipo por Google Chat',
      status: 'pending',
      payload: {
        spaceName: gchatSpace,
        text: `Pulse dejara listo el espacio base de Drive para "${projectName}" con las carpetas iniciales del proyecto.`,
      },
    });
  }

  return context.createRun({
    templateId: 'drive_project_workspace',
    title: `Espacio de Drive: ${projectName}`,
    requestedBy: payload.requestedBy || null,
    input: {
      projectName,
      parentFolderId: parentFolderId || null,
      gchatSpace: gchatSpace || null,
    },
    source: null,
    preview: {
      summary: `Se preparara una estructura base de Drive para ${projectName}.`,
      folders: folders.map((folder) => folder.name),
      parentFolderId: parentFolderId || null,
      gchatSpace: gchatSpace || null,
    },
    actions,
    status: 'needs_approval',
    initialLog: `Se preparo un espacio de Drive para ${projectName}.`,
  });
}
