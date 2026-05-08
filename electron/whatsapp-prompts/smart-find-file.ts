import os from 'node:os';
import { searchFilesWithPowerShell } from './powershell-file-search';
import {
  buildSearchWords,
  normalizeSearchText,
  sanitizeSearchText,
  type FileSearchResult,
} from './search-utils';
import { searchFilesWithWindowsIndex } from './windows-index-search';

export async function smartFindFile(
  filename: string,
): Promise<{ success: boolean; results: FileSearchResult[]; query: string }> {
  const home = os.homedir().replace(/\//g, '\\');
  const sanitized = sanitizeSearchText(filename);
  if (!sanitized) return { success: false, results: [], query: filename };

  const normalizedQuery = normalizeSearchText(sanitized);
  const searchWords = buildSearchWords(normalizedQuery);
  const results = await collectUniqueSearchResults(home, normalizedQuery, searchWords);
  return { success: true, results, query: filename };
}

async function collectUniqueSearchResults(
  home: string,
  normalizedQuery: string,
  searchWords: string[],
): Promise<FileSearchResult[]> {
  const results = await runSearchStrategy('PowerShell', () =>
    searchFilesWithPowerShell(home, normalizedQuery, searchWords),
  );

  if (results.length === 0) {
    results.push(...await runSearchStrategy('Search Index', () =>
      searchFilesWithWindowsIndex(home, normalizedQuery),
    ));
  }

  const seen = new Set<string>();
  return results.filter((result) => {
    const key = result.path.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function runSearchStrategy(
  label: string,
  strategy: () => Promise<FileSearchResult[]>,
): Promise<FileSearchResult[]> {
  try {
    return await strategy();
  } catch (err: any) {
    console.error(`[smart_find_file] ${label} error:`, err.message);
    return [];
  }
}
