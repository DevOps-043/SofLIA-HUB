/**
 * Utilidades de archivos compartidas — Main Process
 * Extraídas de computer-use-handlers.ts para evitar duplicación.
 */
import path from 'node:path';

export function normalizePath(p: string): string {
  return path.resolve(p.replace(/\//g, path.sep));
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
