import * as fs from 'fs';

export async function readFileContent(filePath: string, maxChars: number): Promise<string> {
  let fileHandle: fs.promises.FileHandle | null = null;
  try {
    fileHandle = await fs.promises.open(filePath, 'r');
    const stat = await fileHandle.stat();
    if (stat.size === 0) return '';

    const readSize = Math.min(stat.size, maxChars);
    const buffer = Buffer.alloc(readSize);
    const { bytesRead } = await fileHandle.read(buffer, 0, readSize, 0);
    return buffer.toString('utf-8', 0, bytesRead).replace(/\u0000/g, '').trim();
  } catch (error) {
    console.warn(`[SemanticIndexer] Error reading file ${filePath}:`, error);
    return '';
  } finally {
    if (fileHandle) await fileHandle.close();
  }
}
