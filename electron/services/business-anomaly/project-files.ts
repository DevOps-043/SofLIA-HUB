import fs from 'node:fs/promises';
import path from 'node:path';

const PRESENTATION_TOKENS = ['.ppt', '.pdf', '.key', 'presentacion', 'presentation'];

export async function findProjectDirectory(
  projectsDir: string,
  clientName: string,
): Promise<string | null> {
  try {
    const dirs = await fs.readdir(projectsDir);
    const matchedDir = dirs.find((dir) => dir.toLowerCase().includes(clientName.toLowerCase()));
    return matchedDir ? path.join(projectsDir, matchedDir) : null;
  } catch {
    return null;
  }
}

export async function hasPresentationFile(projectDir: string): Promise<boolean> {
  try {
    const files = await fs.readdir(projectDir);
    return files.some((file) => {
      const lower = file.toLowerCase();
      return PRESENTATION_TOKENS.some((token) => lower.includes(token));
    });
  } catch {
    return false;
  }
}
