import * as fs from 'fs';
import * as path from 'path';
import { EXCLUDED_DIRS } from './constants';

export async function walkDirectory(
  dir: string,
  supportedExtensions: string[],
  fileList: string[] = [],
): Promise<string[]> {
  try {
    const entries = await fs.promises.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        if (EXCLUDED_DIRS.includes(entry.name) || entry.name.startsWith('.')) continue;
        await walkDirectory(fullPath, supportedExtensions, fileList);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (supportedExtensions.includes(ext)) fileList.push(fullPath);
      }
    }
  } catch (err) {
    console.warn(`[SemanticIndexer] Failed to read directory ${dir}:`, err);
  }
  return fileList;
}
