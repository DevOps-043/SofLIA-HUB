import * as fs from 'node:fs';

export async function deleteCleanupFiles(filesToClean: string[]): Promise<{ freed: number; deletedCount: number }> {
  let freed = 0;
  let deletedCount = 0;

  for (const filepath of filesToClean) {
    try {
      const stat = await fs.promises.stat(filepath);
      await fs.promises.unlink(filepath);
      freed += stat.size;
      deletedCount += 1;
    } catch (err) {
      console.error(`[SystemCleanupService] Error al eliminar el archivo ${filepath}:`, err);
    }
  }

  return { freed, deletedCount };
}

export function bytesToGB(bytes: number): string {
  return (bytes / (1024 * 1024 * 1024)).toFixed(2);
}
