import fs from 'node:fs/promises';
import path from 'node:path';
import type { ProgressCallback } from './types';
import { resolveCollision } from './file-utils';
import { loadManifest } from './manifest-store';

export async function undoLastFileOperation(args: Record<string, any>, onProgress?: ProgressCallback): Promise<any> {
  try {
    const { manifest, manifestPath } = await loadManifest(args.operation_id);
    if (manifest.undoneAt) {
      return { success: false, error: `La operacion ${manifest.id} ya fue revertida el ${manifest.undoneAt}.` };
    }

    let restoredCount = 0;
    const errors: string[] = [];
    const restored: Array<{ from: string; to: string }> = [];

    for (const move of [...manifest.moved].reverse()) {
      try {
        if (restoredCount % 25 === 0) {
          onProgress?.(`Revirtiendo operacion ${manifest.id}... ${restoredCount}/${manifest.moved.length}`);
        }

        await fs.access(move.to);
        await fs.mkdir(path.dirname(move.from), { recursive: true });
        const restoreTarget = await resolveCollision(move.from);
        await fs.rename(move.to, restoreTarget);
        restored.push({ from: move.to, to: restoreTarget });
        restoredCount += 1;
      } catch (err: any) {
        errors.push(`${move.to}: ${err.message}`);
      }
    }

    manifest.undoneAt = new Date().toISOString();
    await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');

    return {
      success: true,
      operationId: manifest.id,
      restoredCount,
      errorCount: errors.length,
      restored: restored.slice(0, 50),
      errors: errors.slice(0, 10),
      message: `Se revirtio la operacion ${manifest.id}. Archivos restaurados: ${restoredCount}.`,
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
