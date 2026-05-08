import fs from 'node:fs/promises';
import path from 'node:path';

export async function ensureMonitoringScreenshotDir(screenshotDir: string): Promise<void> {
  try {
    await fs.mkdir(screenshotDir, { recursive: true });
  } catch {
    // Already exists.
  }
}

export async function cleanupMonitoringScreenshots(
  screenshotDir: string,
  maxAgeMs: number = 24 * 60 * 60 * 1000,
): Promise<number> {
  let deleted = 0;
  try {
    const files = await fs.readdir(screenshotDir);
    const now = Date.now();
    for (const file of files) {
      const filePath = path.join(screenshotDir, file);
      try {
        const stat = await fs.stat(filePath);
        if (now - stat.mtimeMs > maxAgeMs) {
          await fs.unlink(filePath);
          deleted++;
        }
      } catch { /* skip */ }
    }
  } catch { /* dir doesn't exist */ }
  return deleted;
}
