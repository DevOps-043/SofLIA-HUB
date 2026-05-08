import fs from 'node:fs';
import { readFileContent } from './file-helpers';

export interface KnowledgeSearchResult {
  file: string;
  line: number;
  snippet: string;
}

export interface KnowledgeFileInfo {
  name: string;
  size: number;
  modified: string;
}

export function searchInFile(
  filePath: string,
  displayName: string,
  queryLower: string,
  results: KnowledgeSearchResult[],
  maxResults: number,
): void {
  try {
    const content = readFileContent(filePath);
    if (!content) return;

    const lines = content.split('\n');
    for (let index = 0; index < lines.length; index++) {
      if (results.length >= maxResults) break;
      if (!lines[index].toLowerCase().includes(queryLower)) continue;
      const start = Math.max(0, index - 1);
      const end = Math.min(lines.length - 1, index + 1);
      const snippet = lines.slice(start, end + 1).join('\n').slice(0, 300);
      results.push({ file: displayName, line: index + 1, snippet });
    }
  } catch {
    // Skip unreadable files.
  }
}

export function addFileInfo(filePath: string, displayName: string, files: KnowledgeFileInfo[]): void {
  try {
    const stat = fs.statSync(filePath);
    files.push({
      name: displayName,
      size: stat.size,
      modified: stat.mtime.toISOString().split('T')[0],
    });
  } catch {
    // Skip unreadable files.
  }
}
