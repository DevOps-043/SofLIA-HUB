import fs from 'node:fs/promises';
import path from 'node:path';
import { MANIFEST_DIR } from './constants';
import type { FileOperationManifest } from './types';

async function ensureManifestDir(): Promise<void> {
  await fs.mkdir(MANIFEST_DIR, { recursive: true });
}

export function buildManifestId(operation: FileOperationManifest['operation']): string {
  return `${operation}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function saveManifest(manifest: FileOperationManifest): Promise<string> {
  await ensureManifestDir();
  const manifestPath = path.join(MANIFEST_DIR, `${manifest.id}.json`);
  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');
  return manifestPath;
}

export async function loadManifest(
  operationId?: string,
): Promise<{ manifest: FileOperationManifest; manifestPath: string }> {
  await ensureManifestDir();

  if (operationId) {
    const manifestPath = path.join(MANIFEST_DIR, `${operationId}.json`);
    const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf-8')) as FileOperationManifest;
    return { manifest, manifestPath };
  }

  const entries = await fs.readdir(MANIFEST_DIR, { withFileTypes: true });
  const manifests = await Promise.all(entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .map(async (entry) => {
      const manifestPath = path.join(MANIFEST_DIR, entry.name);
      const stat = await fs.stat(manifestPath);
      return { manifestPath, mtimeMs: stat.mtimeMs };
    }));

  if (manifests.length === 0) {
    throw new Error('No hay operaciones de archivos registradas para deshacer.');
  }

  manifests.sort((a, b) => b.mtimeMs - a.mtimeMs);
  const latest = manifests[0];
  const manifest = JSON.parse(await fs.readFile(latest.manifestPath, 'utf-8')) as FileOperationManifest;
  return { manifest, manifestPath: latest.manifestPath };
}
