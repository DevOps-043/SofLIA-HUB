import fsSync from 'node:fs';
import path from 'node:path';
import { execAsync } from './exec';
import { stripLaunchExtension } from './path-helpers';
import type { ResolvedApplicationTarget } from './types';

export async function collectRegistryMatches(queryVariants: string[]): Promise<ResolvedApplicationTarget[]> {
  const results = new Map<string, ResolvedApplicationTarget>();
  const exeNames = Array.from(
    new Set(
      queryVariants
        .map((variant) => {
          const base = stripLaunchExtension(path.basename(variant.trim()));
          return base ? `${base}.exe` : '';
        })
        .filter(Boolean),
    ),
  );

  for (const exeName of exeNames.slice(0, 8)) {
    for (const hive of ['HKLM', 'HKCU']) {
      const registryKey = `${hive}\\Software\\Microsoft\\Windows\\CurrentVersion\\App Paths\\${exeName}`;
      try {
        const { stdout } = await execAsync(`reg query "${registryKey}" /ve`, {
          timeout: 2000,
          windowsHide: true,
          maxBuffer: 1024 * 128,
        });
        const match = (stdout || '').match(/REG_\w+\s+([^\r\n]+)\s*$/m);
        const candidate = match?.[1]?.trim();
        if (!candidate || !fsSync.existsSync(candidate)) continue;
        const key = candidate.toLowerCase();
        if (!results.has(key)) {
          results.set(key, { path: candidate, source: 'app-paths', score: 280 });
        }
      } catch {
        // Missing registry entry in this hive.
      }
    }
  }

  return Array.from(results.values());
}
