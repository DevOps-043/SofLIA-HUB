import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export function getFallbackStorageRoot(): string {
  return path.join(os.tmpdir(), 'soflia-background-processes');
}

export async function readTextTail(filePath: string | undefined, maxChars = 8000): Promise<string> {
  if (!filePath || !fsSync.existsSync(filePath)) return '';

  const handle = await fs.open(filePath, 'r');
  try {
    const stats = await handle.stat();
    if (stats.size <= 0) return '';

    const bytesToRead = Math.min(stats.size, maxChars * 4);
    const offset = Math.max(0, stats.size - bytesToRead);
    const buffer = Buffer.alloc(bytesToRead);
    const { bytesRead } = await handle.read(buffer, 0, bytesToRead, offset);
    return buffer.toString('utf8', 0, bytesRead).slice(-maxChars).trim();
  } finally {
    await handle.close();
  }
}
