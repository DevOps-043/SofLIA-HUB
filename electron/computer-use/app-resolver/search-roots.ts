import fsSync from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { ApplicationSearchRoot } from './types';

export function getWindowsApplicationSearchRoots(): ApplicationSearchRoot[] {
  const envCandidates: Array<ApplicationSearchRoot | null> = [
    process.env.LOCALAPPDATA
      ? { root: path.join(process.env.LOCALAPPDATA, 'Programs'), source: 'local-programs', maxDepth: 4 }
      : null,
    process.env.ProgramFiles
      ? { root: process.env.ProgramFiles, source: 'program-files', maxDepth: 4 }
      : null,
    process.env['ProgramFiles(x86)']
      ? { root: process.env['ProgramFiles(x86)'], source: 'program-files-x86', maxDepth: 4 }
      : null,
    process.env.LOCALAPPDATA
      ? {
          root: path.join(process.env.LOCALAPPDATA, 'Microsoft', 'WindowsApps'),
          source: 'windows-apps',
          maxDepth: 2,
        }
      : null,
    process.env.APPDATA
      ? {
          root: path.join(process.env.APPDATA, 'Microsoft', 'Windows', 'Start Menu', 'Programs'),
          source: 'start-menu-user',
          maxDepth: 3,
        }
      : null,
    process.env.ProgramData
      ? {
          root: path.join(process.env.ProgramData, 'Microsoft', 'Windows', 'Start Menu', 'Programs'),
          source: 'start-menu-machine',
          maxDepth: 3,
        }
      : null,
    { root: path.join(os.homedir(), 'Desktop'), source: 'desktop', maxDepth: 2 },
    { root: path.join(os.homedir(), 'Downloads'), source: 'downloads', maxDepth: 2 },
  ];

  const seen = new Set<string>();
  const roots: ApplicationSearchRoot[] = [];
  for (const candidate of envCandidates) {
    if (!candidate) continue;
    const normalized = path.normalize(candidate.root);
    if (seen.has(normalized.toLowerCase())) continue;
    seen.add(normalized.toLowerCase());
    try {
      if (fsSync.existsSync(normalized)) {
        roots.push({ ...candidate, root: normalized });
      }
    } catch {
      // Ignore inaccessible roots.
    }
  }
  return roots;
}
