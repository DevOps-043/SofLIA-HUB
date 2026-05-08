import fs from 'node:fs/promises';
import path from 'node:path';

export interface FileSearchResult {
  name: string;
  path: string;
  size: string;
}

export interface RawFileSearchResult {
  FullName?: string;
  Length?: number;
}

export function sanitizeSearchText(filename: string): string {
  return filename.replace(/["`$;|&<>{}()[\]!^~]/g, '').trim();
}

export function normalizeSearchText(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

export function buildSearchWords(normalized: string): string[] {
  return normalized.split(/\s+/).filter((word) => word.length >= 3);
}

export function toSearchResult(fullPath: string, bytes: number): FileSearchResult {
  return {
    name: path.basename(fullPath),
    path: fullPath,
    size: formatBytes(bytes),
  };
}

export async function readRawSearchResults(outputPath: string): Promise<RawFileSearchResult[]> {
  let jsonOutput = '';
  try {
    jsonOutput = await fs.readFile(outputPath, 'utf-8');
  } catch {
    return [];
  }

  if (!jsonOutput.trim()) return [];
  const parsed = JSON.parse(jsonOutput.trim());
  return Array.isArray(parsed) ? parsed : [parsed];
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
