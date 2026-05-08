import path from 'node:path';

export function normalizeDirectories(directories: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const directory of directories) {
    const trimmed = directory?.trim();
    if (!trimmed) continue;

    const resolved = path.resolve(trimmed);
    const key = resolved.toLowerCase();
    if (seen.has(key)) continue;

    seen.add(key);
    result.push(resolved);
  }

  return result;
}
