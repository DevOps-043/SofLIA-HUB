import fs from 'node:fs/promises';
import path from 'node:path';

import { mcpManager } from '../mcp-manager';
import type { DynamicToolPaths } from './paths';
import type { ToolsetManifest } from './types';

export async function installToolset(paths: DynamicToolPaths, builtinToolsets: Record<string, any>, toolsetId: string) {
  const toolset = builtinToolsets[toolsetId];
  if (!toolset) throw new Error(`No existe un toolset instalable con id "${toolsetId}".`);

  const managedToolsPath = paths.getManagedDynamicToolsPath();
  const manifestPath = paths.getToolsetManifestPath(toolsetId);
  const alreadyInstalled = await fs.access(manifestPath).then(() => true).catch(() => false);
  await fs.mkdir(managedToolsPath, { recursive: true });
  await fs.mkdir(path.dirname(manifestPath), { recursive: true });

  const writtenFiles: string[] = [];
  for (const file of toolset.buildFiles()) {
    const absolutePath = path.join(managedToolsPath, file.fileName);
    await fs.writeFile(absolutePath, file.content, 'utf8');
    writtenFiles.push(absolutePath);
  }

  await fs.writeFile(manifestPath, JSON.stringify(buildManifest(toolset), null, 2), 'utf8');
  await mcpManager.refreshTools();

  return {
    success: true,
    toolset_id: toolset.id,
    name: toolset.name,
    installedTools: [...toolset.toolNames],
    files: writtenFiles,
    managedToolsPath,
    manifestPath,
    envRequired: [...toolset.envRequired],
    alreadyInstalled,
    message: buildInstallMessage(toolset.name, managedToolsPath, toolset.envRequired, alreadyInstalled),
  };
}

export async function uninstallToolset(paths: DynamicToolPaths, toolsetId: string) {
  const manifestPath = paths.getToolsetManifestPath(toolsetId);
  const files = await paths.getManagedToolsetFiles(toolsetId);
  for (const file of files) await fs.rm(file, { force: true });
  const removedManifest = await fs.rm(path.dirname(manifestPath), { recursive: true, force: true })
    .then(() => true)
    .catch(() => false);
  await mcpManager.refreshTools();

  return {
    success: true,
    toolset_id: toolsetId,
    removedFiles: files,
    removedManifest,
    message: files.length > 0 || removedManifest
      ? `Toolset ${toolsetId} desinstalado del directorio dinamico administrado.`
      : `No encontre archivos administrados para el toolset ${toolsetId}, pero se refresco el catalogo.`,
  };
}

function buildManifest(toolset: any): ToolsetManifest {
  return {
    id: toolset.id,
    name: toolset.name,
    description: toolset.description,
    version: 1,
    installedAt: new Date().toISOString(),
    source: 'builtin',
    envRequired: [...toolset.envRequired],
    toolNames: [...toolset.toolNames],
    promptHints: [...toolset.promptHints],
  };
}

function buildInstallMessage(name: string, managedToolsPath: string, envRequired: string[], alreadyInstalled: boolean): string {
  return alreadyInstalled
    ? `Toolset ${name} actualizado en ${managedToolsPath}. Verifica las variables ${envRequired.join(', ')} para usarlo.`
    : `Toolset ${name} instalado en ${managedToolsPath}. Configura ${envRequired.join(', ')} para usarlo.`;
}
