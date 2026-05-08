import * as fsPromises from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import type { ScannedDir } from './types';

export async function markChangedKeyDirs(
  keyPaths: Map<string, string>,
  scannedDirs: Map<string, ScannedDir>,
  changedDirs: Set<string>,
): Promise<void> {
  if (changedDirs.size > 0) return;

  for (const [, dirPath] of keyPaths.entries()) {
    if (dirPath === os.homedir()) continue;
    const scanned = scannedDirs.get(path.normalize(dirPath));
    if (!scanned) {
      changedDirs.add(dirPath);
      continue;
    }

    try {
      const stats = await fsPromises.stat(dirPath);
      if (stats.mtimeMs > scanned.lastScanMs) changedDirs.add(dirPath);
    } catch {}
  }
}
