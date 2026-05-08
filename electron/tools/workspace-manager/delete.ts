import fs from 'fs/promises';
import { getWorkspacePath } from './paths';

export async function deleteWorkspace(name: string): Promise<string> {
  try {
    await fs.unlink(getWorkspacePath(name));
    return `Espacio de trabajo '${name}' eliminado correctamente.`;
  } catch (error: any) {
    if (error.code === 'ENOENT') return `El espacio '${name}' no existe.`;
    return `Error al eliminar el espacio: ${error.message}`;
  }
}
