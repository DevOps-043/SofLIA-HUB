import fs from 'node:fs';

export async function waitForFileReady(filePath: string, maxAttempts = 15): Promise<boolean> {
  let attempts = 0;
  let lastSize = -1;
  let lastMtime = 0;
  let stableCount = 0;

  while (attempts < maxAttempts) {
    try {
      const stats = await fs.promises.stat(filePath);
      if (stats.size > 0 && stats.size === lastSize && stats.mtimeMs === lastMtime) {
        stableCount++;
        if (stableCount >= 2) return true;
      } else {
        stableCount = 0;
      }

      lastSize = stats.size;
      lastMtime = stats.mtimeMs;
    } catch (err: any) {
      if (err.code === 'ENOENT') return false;
    }

    await new Promise((resolve) => setTimeout(resolve, 1500));
    attempts++;
  }

  return false;
}
