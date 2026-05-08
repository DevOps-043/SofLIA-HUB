import * as fs from 'node:fs';

export function ensureToolDirectories(directories: string[]): void {
  for (const directory of directories) {
    if (!fs.existsSync(directory)) fs.mkdirSync(directory, { recursive: true });
  }
}
