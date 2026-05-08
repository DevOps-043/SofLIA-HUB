import * as path from 'node:path';
import { MAX_PATHS_MD_SIZE } from './constants';
import type { ScannedDir } from './types';

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function buildPathsMarkdown(
  home: string,
  keyPaths: Map<string, string>,
  scannedDirs: Map<string, ScannedDir>,
): string {
  const username = path.basename(home);
  const now = new Date().toLocaleString('es-MX', { timeZone: 'America/Mexico_City' });
  let md = `# Mapa de Rutas del Sistema\n`;
  md += `Ultima actualizacion: ${now}\n`;
  md += `Usuario: ${username}\n`;
  md += `Home: ${home}\n\n`;
  md += `## Rutas Clave\n`;

  for (const [label, dirPath] of keyPaths.entries()) md += `- ${label}: ${dirPath}\n`;
  md += `\n`;

  const keyDirs = new Set([...keyPaths.values()].map((value) => path.normalize(value)));
  for (const [normalizedPath, scanned] of scannedDirs.entries()) {
    if (!keyDirs.has(normalizedPath) && !scanned.label) continue;
    md += renderScannedDir(normalizedPath, scanned);
    if (md.length > MAX_PATHS_MD_SIZE) {
      md += `[Truncado - demasiados directorios para indexar]\n`;
      break;
    }
  }

  return md;
}

function renderScannedDir(normalizedPath: string, scanned: ScannedDir): string {
  let md = `## ${scanned.label || path.basename(normalizedPath)} (${normalizedPath})\n`;
  const fileEntries = scanned.entries.filter((entry) => !entry.isDir);
  const dirEntries = scanned.entries.filter((entry) => entry.isDir);

  if (dirEntries.length > 0) md += `Carpetas: ${dirEntries.map((entry) => entry.name).join(', ')}\n`;
  const recentFiles = fileEntries.slice(0, 30);
  if (recentFiles.length > 0) {
    md += `Archivos recientes:\n`;
    for (const file of recentFiles) {
      const sizeStr = file.size !== undefined ? ` (${formatSize(file.size)})` : '';
      md += `- ${file.name}${sizeStr}\n`;
    }
  }
  if (fileEntries.length > 30) md += `... y ${fileEntries.length - 30} archivos mas\n`;
  return `${md}\n`;
}
