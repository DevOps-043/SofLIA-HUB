import * as fsPromises from 'node:fs/promises';
import * as path from 'node:path';
import { KEY_FOLDER_VARIANTS } from './constants';

async function dirExists(dirPath: string): Promise<boolean> {
  try {
    const stats = await fsPromises.stat(dirPath);
    return stats.isDirectory();
  } catch {
    return false;
  }
}

async function findOneDrivePaths(home: string): Promise<string[]> {
  const results: string[] = [];
  try {
    const entries = await fsPromises.readdir(home, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory() && entry.name.startsWith('OneDrive')) {
        results.push(path.join(home, entry.name));
      }
    }
  } catch {}
  return results;
}

export async function resolveKeyPaths(home: string): Promise<Map<string, string>> {
  const keyPaths = new Map<string, string>();
  keyPaths.set('Home', home);

  const oneDriveCandidates = await findOneDrivePaths(home);
  const searchRoots = [home, ...oneDriveCandidates];

  for (const [label, variants] of Object.entries(KEY_FOLDER_VARIANTS)) {
    for (const root of searchRoots) {
      const found = await findFirstExistingVariant(root, variants);
      if (!found) continue;
      const prefix = root === home ? '' : '(OneDrive) ';
      keyPaths.set(`${prefix}${label}`, found);
      break;
    }
  }

  for (const oneDrivePath of oneDriveCandidates) keyPaths.set('OneDrive', oneDrivePath);
  return keyPaths;
}

async function findFirstExistingVariant(root: string, variants: string[]): Promise<string | null> {
  for (const variant of variants) {
    const candidate = path.join(root, variant);
    if (await dirExists(candidate)) return candidate;
  }
  return null;
}
