import { workspaceSchema } from './workspace-manager/schema';
import { deleteWorkspace } from './workspace-manager/delete';
import { listWorkspaces } from './workspace-manager/list';
import { restoreWorkspace } from './workspace-manager/restore';
import { saveWorkspace } from './workspace-manager/save';
import { ensureWorkspaceDir } from './workspace-manager/paths';
import type { WorkspaceActionInput } from './workspace-manager/types';

export const workspaceManagerTool = {
  name: 'workspace_manager',
  description: 'Gestor completo de espacios de trabajo. Permite guardar, restaurar, listar o eliminar espacios guardados.',
  schema: workspaceSchema,
  handler: async (input: WorkspaceActionInput) => {
    await ensureWorkspaceDir();

    if (input.action === 'list') return listWorkspaces();
    if (!input.name) return `Error: Se requiere el parametro 'name' para la accion '${input.action}'.`;
    if (input.action === 'delete') return deleteWorkspace(input.name);
    if (input.action === 'save') return saveWorkspace(input.name);
    if (input.action === 'restore') return restoreWorkspace(input.name);

    return `Accion '${input.action}' no reconocida.`;
  },
};
