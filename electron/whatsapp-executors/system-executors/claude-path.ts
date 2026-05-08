import os from 'node:os';
import { execAsync } from './exec';

export async function resolveClaudePath(): Promise<string> {
  const claudePaths = [
    `C:\\Users\\${os.userInfo().username}\\AppData\\Roaming\\npm\\claude.cmd`,
    `C:\\Users\\${os.userInfo().username}\\AppData\\Local\\npm-cache\\_npx\\claude.cmd`,
  ];

  for (const candidate of claudePaths) {
    try {
      await execAsync(`if exist "${candidate}" echo found`, { windowsHide: true, timeout: 3000 });
      return candidate;
    } catch {}
  }

  return 'claude';
}
