import fs from 'node:fs/promises';
import path from 'node:path';
import { TYPE_CATEGORIES } from './constants';
import type { CollectedFile } from './types';

export function getCategoryForExt(ext: string, mode: string, customRules?: Record<string, string>): string {
  if (mode === 'custom' && customRules) {
    return customRules[ext] || customRules['*'] || ext;
  }
  if (mode === 'type') {
    for (const [category, exts] of Object.entries(TYPE_CATEGORIES)) {
      if (exts.includes(ext)) return category;
    }
    return 'Otros';
  }
  return ext.toUpperCase();
}

export async function collectFiles(root: string, recursive: boolean, maxDepth = 8): Promise<CollectedFile[]> {
  const collected: CollectedFile[] = [];

  async function walk(currentDir: string, depth: number) {
    const entries = await fs.readdir(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      const fullPath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        if (recursive && depth < maxDepth) await walk(fullPath, depth + 1);
        continue;
      }

      collected.push({
        name: entry.name,
        fullPath,
        relativePath: path.relative(root, fullPath),
      });
    }
  }

  await walk(root, 0);
  return collected;
}

export async function resolveCollision(targetPath: string): Promise<string> {
  try {
    await fs.access(targetPath);
    const parsed = path.parse(targetPath);
    return path.join(parsed.dir, `${parsed.name}_${Date.now()}${parsed.ext}`);
  } catch {
    return targetPath;
  }
}
