import type { DriveService } from '../../drive-service';
import type { DriveFolderDefinition } from '../types';

export function buildDriveWorkspaceFolders(): DriveFolderDefinition[] {
  return [
    { name: '01 Direccion' },
    { name: '02 Operacion' },
    { name: '03 Comercial' },
    { name: '04 Entregables' },
    { name: '05 Finanzas' },
  ];
}

export function normalizeDriveFolderDefinition(value: unknown): DriveFolderDefinition | null {
  if (!value || typeof value !== 'object') return null;

  const source = value as { name?: unknown; children?: unknown };
  const name = String(source.name || '').trim();
  if (!name) return null;

  const children = Array.isArray(source.children)
    ? source.children
        .map((item) => normalizeDriveFolderDefinition(item))
        .filter((item): item is DriveFolderDefinition => Boolean(item))
    : [];

  return children.length > 0 ? { name, children } : { name };
}

export async function createDriveFolderTree(
  driveService: DriveService,
  parentFolderId: string,
  folders: DriveFolderDefinition[],
): Promise<Array<{ name: string; folderId: string; parentFolderId: string }>> {
  const created: Array<{ name: string; folderId: string; parentFolderId: string }> = [];

  for (const folder of folders) {
    const result = await driveService.createFolder(folder.name, parentFolderId);
    if (!result.success || !result.folderId) {
      throw new Error(result.error || `No se pudo crear la carpeta ${folder.name}.`);
    }

    created.push({ name: folder.name, folderId: result.folderId, parentFolderId });
    if (folder.children?.length) {
      created.push(...await createDriveFolderTree(driveService, result.folderId, folder.children));
    }
  }

  return created;
}
