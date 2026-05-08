import { app } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';

export function createDynamicToolPaths() {
  const getWorkspaceDynamicToolsPath = () => path.join(process.cwd(), 'tools', 'dynamic');
  const getManagedDynamicToolsPath = () => path.join(app.getPath('userData'), 'dynamic-tools');
  const getToolsetMetadataRootPath = () => path.join(getManagedDynamicToolsPath(), '_toolsets');

  return {
    getWorkspaceDynamicToolsPath,
    getManagedDynamicToolsPath,
    getToolsetMetadataRootPath,
    getToolsetManifestPath: (toolsetId: string) => path.join(getToolsetMetadataRootPath(), toolsetId, 'manifest.json'),
    getConfiguredToolDirectories: () => [getWorkspaceDynamicToolsPath(), getManagedDynamicToolsPath()],
    ensureMetadataRoot: () => fs.mkdir(getToolsetMetadataRootPath(), { recursive: true }),
    getManagedToolsetFiles: (toolsetId: string) => getManagedToolsetFiles(getManagedDynamicToolsPath(), toolsetId),
  };
}

export type DynamicToolPaths = ReturnType<typeof createDynamicToolPaths>;

async function getManagedToolsetFiles(managedToolsPath: string, toolsetId: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(managedToolsPath, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile() && entry.name.startsWith(`${toolsetId}.`))
      .map((entry) => path.join(managedToolsPath, entry.name));
  } catch (error: any) {
    if (error?.code === 'ENOENT') return [];
    throw error;
  }
}
