import fs from 'fs/promises';
import { execAsync } from './exec';
import { getWorkspacePath } from './paths';
import type { SavedWorkspaceApp } from './types';

export async function restoreWorkspace(name: string): Promise<string> {
  try {
    const data = await fs.readFile(getWorkspacePath(name), 'utf-8');
    const apps = JSON.parse(data) as SavedWorkspaceApp[];
    if (!Array.isArray(apps) || apps.length === 0) return `El espacio de trabajo '${name}' esta vacio.`;

    const result = await restoreApps(apps);
    let message = `Espacio '${name}' restaurado en la PC.\nSe iniciaron ${result.restoredCount} aplicaciones.`;
    if (result.failedApps.length > 0) {
      message += `\nFallaron ${result.failedApps.length} aplicaciones: ${result.failedApps.join(', ')}.`;
    }
    return message;
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      return `El espacio de trabajo '${name}' no existe. Puedes ver los disponibles usando la accion 'list'.`;
    }
    return `Error al restaurar el espacio de trabajo: ${error.message}`;
  }
}

async function restoreApps(apps: SavedWorkspaceApp[]) {
  let restoredCount = 0;
  const failedApps: string[] = [];

  for (const app of apps) {
    try {
      await execAsync(app.Path ? `start "" "${app.Path}"` : `start ${app.Name}`);
      restoredCount += 1;
    } catch {
      failedApps.push(app.Name || 'Desconocido');
    }
  }

  return { restoredCount, failedApps };
}
