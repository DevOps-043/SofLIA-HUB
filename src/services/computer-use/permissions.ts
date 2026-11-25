import type { ComputerPermissionMode, ComputerPermissionResponse } from '../../shared/computer-permissions';

export function hasComputerPermissions(): boolean {
  return typeof window.computerUse?.permissionMode === 'function';
}

export async function computerPermissionMode(mode?: ComputerPermissionMode): Promise<ComputerPermissionResponse> {
  try {
    return await window.computerUse?.permissionMode?.(mode) ?? { success: false, error: 'Los permisos locales no están disponibles.' };
  } catch {
    return { success: false, error: 'No se pudieron consultar los permisos locales.' };
  }
}

export async function isFullComputerAccess(): Promise<boolean> {
  const permission = await computerPermissionMode();
  return permission.success && permission.mode === 'full';
}
