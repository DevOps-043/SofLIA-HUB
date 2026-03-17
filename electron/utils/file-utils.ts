/**
 * Shared file utilities for the Electron main process.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const KNOWN_FOLDER_ALIASES: Record<string, string[]> = {
  desktop: ['desktop', 'escritorio'],
  downloads: ['downloads', 'descargas'],
  documents: ['documents', 'documentos'],
  pictures: ['pictures', 'imagenes', 'imágenes'],
  music: ['music', 'musica', 'música'],
  videos: ['videos', 'video'],
};

function findExistingCandidate(candidates: string[]): string | null {
  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate)) return candidate;
    } catch {
      // Ignore inaccessible candidates and keep trying.
    }
  }
  return null;
}

function getKnownFolderPath(alias: string): string | null {
  const normalizedAlias = alias.trim().toLowerCase();
  const home = os.homedir();

  for (const variants of Object.values(KNOWN_FOLDER_ALIASES)) {
    if (!variants.includes(normalizedAlias)) continue;

    const titleCase = variants.map(name => name.charAt(0).toUpperCase() + name.slice(1));
    const candidates = [
      ...titleCase.map(name => path.join(home, name)),
      ...titleCase.map(name => path.join(home, 'OneDrive', name)),
      ...titleCase.map(name => path.join(home, 'OneDrive - Personal', name)),
    ];

    const found = findExistingCandidate(candidates);
    if (found) return found;
  }

  return null;
}

export function normalizePath(inputPath: string): string {
  const rawInput = (inputPath || '').trim();
  if (!rawInput) return os.homedir();

  let normalized = rawInput.replace(/^["']|["']$/g, '');
  normalized = normalized.replace(/\//g, path.sep);

  if (normalized === '~') return os.homedir();
  if (normalized.startsWith(`~${path.sep}`)) {
    normalized = path.join(os.homedir(), normalized.slice(2));
  }

  if (!path.isAbsolute(normalized)) {
    const parts = normalized.split(/[\\/]+/).filter(Boolean);
    if (parts.length > 0) {
      const knownFolder = getKnownFolderPath(parts[0]);
      if (knownFolder) {
        return path.resolve(path.join(knownFolder, ...parts.slice(1)));
      }
    }
  }

  return path.resolve(normalized);
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function getFileExtension(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  return ext ? ext.slice(1) : '';
}
