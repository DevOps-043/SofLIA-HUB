import fs from 'node:fs/promises';

import type { DynamicToolPaths } from './paths';
import type { ToolsetManifest } from './types';

export function listInstallableToolsets(builtinToolsets: Record<string, any>, installed: ToolsetManifest[]) {
  const installedIds = new Set(installed.map((item) => item.id));
  return Object.values(builtinToolsets).map((toolset: any) => ({
    id: toolset.id,
    name: toolset.name,
    description: toolset.description,
    envRequired: [...toolset.envRequired],
    toolNames: [...toolset.toolNames],
    promptHints: [...toolset.promptHints],
    installed: installedIds.has(toolset.id),
  }));
}

export async function listInstalledToolsets(paths: DynamicToolPaths): Promise<ToolsetManifest[]> {
  const manifests: ToolsetManifest[] = [];
  try {
    const entries = await fs.readdir(paths.getToolsetMetadataRootPath(), { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      try {
        const raw = await fs.readFile(paths.getToolsetManifestPath(entry.name), 'utf8');
        manifests.push(JSON.parse(raw) as ToolsetManifest);
      } catch (error) {
        console.warn(`[DynamicToolService] No se pudo leer el manifiesto del toolset ${entry.name}:`, error);
      }
    }
  } catch (error: any) {
    if (error?.code !== 'ENOENT') console.error('[DynamicToolService] Error listando toolsets instalados:', error);
  }
  manifests.sort((a, b) => a.name.localeCompare(b.name));
  return manifests;
}
