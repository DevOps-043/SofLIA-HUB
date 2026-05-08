import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type { CleanupConfig, CleanupScanResult } from './types';

export async function scanCleanupCandidates(config: CleanupConfig): Promise<CleanupScanResult> {
  const directoriesToCheck = [path.join(os.homedir(), 'Downloads'), os.tmpdir()];
  const oldFiles: { filepath: string; size: number }[] = [];
  const now = Date.now();
  const ageThresholdMs = (config.ageThresholdDays || 30) * 24 * 60 * 60 * 1000;
  let totalSize = 0;

  for (const dir of directoriesToCheck) {
    const result = await scanDirectory(dir, now, ageThresholdMs);
    totalSize += result.totalSize;
    oldFiles.push(...result.oldFiles);
  }

  return {
    totalSize,
    filesToClean: oldFiles.map((file) => file.filepath),
    totalBytesFound: oldFiles.reduce((acc, file) => acc + file.size, 0),
  };
}

async function scanDirectory(dir: string, now: number, ageThresholdMs: number) {
  const stats = await fs.promises.stat(dir).catch(() => null);
  if (!stats?.isDirectory()) return { totalSize: 0, oldFiles: [] as { filepath: string; size: number }[] };

  let totalSize = 0;
  const oldFiles: { filepath: string; size: number }[] = [];
  for (const file of await fs.promises.readdir(dir)) {
    const filepath = path.join(dir, file);
    try {
      const fileStat = await fs.promises.stat(filepath);
      if (!fileStat.isFile()) continue;
      totalSize += fileStat.size;
      if (now - fileStat.mtimeMs > ageThresholdMs) oldFiles.push({ filepath, size: fileStat.size });
    } catch {
      // Ignorar archivos inaccesibles o bloqueados por el sistema.
    }
  }
  return { totalSize, oldFiles };
}
