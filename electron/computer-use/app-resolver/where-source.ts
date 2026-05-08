import fsSync from 'node:fs';
import path from 'node:path';
import { execAsync } from './exec';
import { stripLaunchExtension } from './path-helpers';
import type { ResolvedApplicationTarget } from './types';

export async function collectWhereMatches(queryVariants: string[]): Promise<ResolvedApplicationTarget[]> {
  const results = new Map<string, ResolvedApplicationTarget>();
  for (const rawVariant of queryVariants.slice(0, 8)) {
    const baseVariant = stripLaunchExtension(path.basename(rawVariant));
    const attempts = new Set<string>([rawVariant, baseVariant, `${baseVariant}.exe`]);

    for (const attempt of attempts) {
      const command = attempt.trim();
      if (!command) continue;
      try {
        const { stdout } = await execAsync(`where.exe "${command.replace(/"/g, '\\"')}"`, {
          timeout: 1500,
          windowsHide: true,
          maxBuffer: 1024 * 128,
        });

        for (const line of (stdout || '').split(/\r?\n/)) {
          const candidate = line.trim();
          if (!candidate || !fsSync.existsSync(candidate)) continue;
          const key = candidate.toLowerCase();
          if (!results.has(key)) {
            results.set(key, { path: candidate, source: 'where', score: 260 });
          }
        }
      } catch {
        // No match for this variant.
      }
    }
  }
  return Array.from(results.values());
}
