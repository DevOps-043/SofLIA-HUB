import fs from 'fs/promises';
import os from 'os';
import path from 'path';

export const workspaceDir = path.join(os.homedir(), '.soflia', 'workspaces');

export async function ensureWorkspaceDir(): Promise<void> {
  await fs.mkdir(workspaceDir, { recursive: true });
}

export function getWorkspacePath(name: string): string {
  const safeName = name.replace(/[^a-z0-9_-]/gi, '_').toLowerCase();
  return path.join(workspaceDir, `${safeName}.json`);
}
