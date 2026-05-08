import { normalizeDriveFolderDefinition } from '../helpers';
import {
  createPendingAction,
} from './custom-action-utils';
import type {
  DriveFolderDefinition,
  WorkflowActionRecord,
} from '../types';

export function buildDesktopTaskAction(title: string, payload: Record<string, any>): WorkflowActionRecord | null {
  const task = String(payload.task || '').trim();
  if (!task) return null;
  const backend = ['auto', 'browser', 'desktop', 'uia'].includes(String(payload.backend || ''))
    ? String(payload.backend)
    : undefined;
  return createPendingAction('desktop_task', title, {
    task,
    maxSteps: Number(payload.maxSteps) || undefined,
    backend,
    startUrl: String(payload.startUrl || '').trim() || undefined,
  });
}

export function buildDriveFolderTreeAction(title: string, payload: Record<string, any>): WorkflowActionRecord | null {
  const projectName = String(payload.projectName || '').trim();
  const parentFolderId = String(payload.parentFolderId || '').trim();
  const folders = Array.isArray(payload.folders)
    ? payload.folders
        .map((item) => normalizeDriveFolderDefinition(item))
        .filter((item): item is DriveFolderDefinition => Boolean(item))
    : [];
  if (!projectName || folders.length === 0) return null;
  return createPendingAction('drive_folder_tree', title, {
    projectName,
    parentFolderId: parentFolderId || undefined,
    folders,
  });
}
