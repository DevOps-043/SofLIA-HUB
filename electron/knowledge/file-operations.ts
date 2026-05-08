import path from 'node:path';
import fs from 'node:fs';
import { readFileContent, resolveKnowledgePath } from './file-helpers';
import { DAILY_DIR, MEMORY_FILE, USERS_DIR } from './constants';
import {
  addFileInfo,
  searchInFile,
  type KnowledgeFileInfo,
  type KnowledgeSearchResult,
} from './search-helpers';

export function readKnowledgeFileContent(fileName: string): { success: boolean; content?: string; message?: string } {
  const resolvedPath = resolveKnowledgePath(fileName);
  const normalizedFileName = fileName.replace(/\\/g, '/');
  const isDailyLog = /^memory\/\d{4}-\d{2}-\d{2}(\.md)?$/.test(normalizedFileName);

  if (!resolvedPath) {
    if (isDailyLog) return missingDailyLog(fileName);
    return { success: false, message: `Archivo no encontrado: ${fileName}` };
  }

  const content = readFileContent(resolvedPath);
  if (content !== null) return { success: true, content };
  if (isDailyLog) return missingDailyLog(fileName);
  return { success: false, message: `No se pudo leer: ${fileName}` };
}

export function searchKnowledgeFiles(query: string, maxResults: number = 10): KnowledgeSearchResult[] {
  const results: KnowledgeSearchResult[] = [];
  const queryLower = query.toLowerCase();
  searchInFile(MEMORY_FILE, 'MEMORY.md', queryLower, results, maxResults);
  searchDirectoryFiles(USERS_DIR, 'users', queryLower, results, maxResults);
  searchRecentDailyLogs(queryLower, results, maxResults);
  return results;
}

export function listKnowledgeFiles(): KnowledgeFileInfo[] {
  const files: KnowledgeFileInfo[] = [];
  addFileInfo(MEMORY_FILE, 'MEMORY.md', files);
  listDirectoryFiles(USERS_DIR, 'users', files);
  listDirectoryFiles(DAILY_DIR, 'memory', files, 15);
  return files;
}

function missingDailyLog(fileName: string) {
  console.log(`[KnowledgeService] Intercepted missing daily log request: ${fileName}`);
  return { success: true, content: 'Aún no hay registros para hoy. El sistema está inicializado.' };
}

function searchDirectoryFiles(
  directory: string,
  label: string,
  queryLower: string,
  results: KnowledgeSearchResult[],
  maxResults: number,
): void {
  if (results.length >= maxResults || !fs.existsSync(directory)) return;
  for (const file of fs.readdirSync(directory)) {
    if (!file.endsWith('.md') || results.length >= maxResults) continue;
    searchInFile(path.join(directory, file), `${label}/${file}`, queryLower, results, maxResults);
  }
}

function searchRecentDailyLogs(queryLower: string, results: KnowledgeSearchResult[], maxResults: number): void {
  if (results.length >= maxResults || !fs.existsSync(DAILY_DIR)) return;
  const dailyFiles = fs.readdirSync(DAILY_DIR).filter(file => file.endsWith('.md')).sort().reverse().slice(0, 30);
  for (const file of dailyFiles) {
    if (results.length >= maxResults) break;
    searchInFile(path.join(DAILY_DIR, file), `memory/${file}`, queryLower, results, maxResults);
  }
}

function listDirectoryFiles(directory: string, label: string, files: KnowledgeFileInfo[], limit?: number): void {
  if (!fs.existsSync(directory)) return;
  const names = fs.readdirSync(directory).sort().reverse();
  for (const file of typeof limit === 'number' ? names.slice(0, limit) : names) {
    if (file.endsWith('.md')) addFileInfo(path.join(directory, file), `${label}/${file}`, files);
  }
}
