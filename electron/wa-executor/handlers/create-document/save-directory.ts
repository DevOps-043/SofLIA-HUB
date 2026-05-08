import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

export async function resolveSaveDirectory(requested: string): Promise<string> {
  if (requested) return requested;

  const home = os.homedir();
  const oneDriveDesktop = path.join(home, 'OneDrive', 'Escritorio');
  try {
    await fs.access(oneDriveDesktop);
    return oneDriveDesktop;
  } catch {
    return path.join(home, 'Desktop');
  }
}
