import fs from 'fs/promises';
import { workspaceDir } from './paths';

export async function listWorkspaces(): Promise<string> {
  try {
    const files = await fs.readdir(workspaceDir);
    const workspaces = files
      .filter((file) => file.endsWith('.json'))
      .map((file) => file.replace('.json', ''));

    if (workspaces.length === 0) {
      return 'No tienes ningun espacio de trabajo guardado todavia.';
    }
    return `Espacios de trabajo disponibles:\n- ${workspaces.join('\n- ')}`;
  } catch (error: any) {
    return `Error al listar espacios: ${error.message}`;
  }
}
