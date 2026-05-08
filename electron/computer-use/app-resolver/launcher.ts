import { shell } from 'electron';
import path from 'node:path';
import { backgroundProcessService, type ManagedSessionView } from '../../background-process-service';
import { normalizePath } from '../../utils/file-utils';

export async function launchPathNonBlocking(
  resolvedPath: string,
  metadata?: Record<string, any>,
): Promise<{ success: boolean; error?: string; session?: ManagedSessionView | null }> {
  const normalized = normalizePath(resolvedPath);

  if (process.platform === 'win32') {
    try {
      const session = await backgroundProcessService.launchApplication({
        targetPath: normalized,
        title: `Aplicacion: ${path.basename(normalized)}`,
        metadata,
      });
      if (session.status === 'failed') {
        return { success: false, error: session.lastError || 'No se pudo iniciar el proceso.', session };
      }
      return { success: true, session };
    } catch (err: any) {
      return {
        success: false,
        error: err?.stderr?.trim() || err?.stdout?.trim() || err?.message || 'No se pudo iniciar el proceso.',
      };
    }
  }

  try {
    const result = await shell.openPath(normalized);
    if (result) {
      return { success: false, error: result };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'No se pudo abrir el elemento.' };
  }
}
