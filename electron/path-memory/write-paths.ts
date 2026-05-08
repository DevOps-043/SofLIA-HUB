import * as fsPromises from 'node:fs/promises';
import * as os from 'node:os';
import { buildPathsMarkdown } from './markdown';
import type { ScannedDir } from './types';

export async function writePathsMarkdownFile(
  pathsFilePath: string,
  keyPaths: Map<string, string>,
  scannedDirs: Map<string, ScannedDir>,
): Promise<{ size: number; dirs: number }> {
  const md = buildPathsMarkdown(os.homedir(), keyPaths, scannedDirs);
  await fsPromises.writeFile(pathsFilePath, md, 'utf-8');
  return { size: md.length, dirs: scannedDirs.size };
}
