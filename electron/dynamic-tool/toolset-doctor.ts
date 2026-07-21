import path from 'node:path';
import type { DynamicToolPaths } from './paths';
import type { ToolsetManifest } from './types';

type LoadedToolInfo = {
  name: string;
  sourceScope: 'workspace' | 'managed' | 'unknown';
};

export async function doctorToolsets(
  paths: DynamicToolPaths,
  installed: ToolsetManifest[],
  loadedTools: LoadedToolInfo[],
) {
  const loadedByToolName = new Map(loadedTools.map((tool) => [tool.name, tool]));
  const diagnostics = await Promise.all(installed.map(async (toolset) => {
    const files = await paths.getManagedToolsetFiles(toolset.id);
    const env = toolset.envRequired.map((name) => ({ name, present: Boolean(process.env[name]?.trim()) }));
    const loadedForToolset = toolset.toolNames.filter((name) => loadedByToolName.get(name)?.sourceScope === 'managed');
    const issues = collectToolsetIssues(toolset, files, env, loadedForToolset);

    return {
      id: toolset.id,
      name: toolset.name,
      status: issues.length === 0 ? 'ok' as const : files.length === 0 ? 'missing' as const : 'degraded' as const,
      issues,
      env,
      installedTools: [...toolset.toolNames],
      loadedTools: loadedForToolset,
      manifestFile: path.basename(paths.getToolsetManifestPath(toolset.id)),
      files: files.map((file) => path.basename(file)),
    };
  }));

  diagnostics.sort((a, b) => a.name.localeCompare(b.name));
  return diagnostics;
}

function collectToolsetIssues(
  toolset: ToolsetManifest,
  files: string[],
  env: Array<{ name: string; present: boolean }>,
  loadedForToolset: string[],
) {
  const issues: string[] = [];
  if (files.length === 0) issues.push('No se encontraron archivos del toolset en dynamic-tools.');
  if (loadedForToolset.length !== toolset.toolNames.length) {
    const missingTools = toolset.toolNames.filter((name) => !loadedForToolset.includes(name));
    issues.push(`Faltan tools cargadas: ${missingTools.join(', ')}`);
  }
  const missingEnv = env.filter((item) => !item.present).map((item) => item.name);
  if (missingEnv.length > 0) issues.push(`Faltan variables de entorno: ${missingEnv.join(', ')}`);
  return issues;
}
