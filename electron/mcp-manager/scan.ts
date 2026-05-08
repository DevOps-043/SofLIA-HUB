import * as fs from 'node:fs';
import * as path from 'node:path';

export async function scanToolDirectories(
  directories: string[],
  registerTool: (filePath: string, rootPath: string) => Promise<void>,
): Promise<void> {
  try {
    for (const directory of directories) {
      if (!fs.existsSync(directory)) continue;
      const files = fs.readdirSync(directory).sort((a, b) => a.localeCompare(b));
      for (const file of files) {
        await registerTool(path.join(directory, file), directory);
      }
    }
  } catch (error) {
    console.error('[MCP] Error scanning dynamic tools:', error);
  }
}
