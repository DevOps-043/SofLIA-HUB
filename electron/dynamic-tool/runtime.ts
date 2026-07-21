import { mcpManager, type ToolSchema, type ToolSourceInfo } from '../mcp-manager';
import { normalizeGeminiSchemaNode } from './schema';
import type { DynamicToolPaths } from './paths';

export function listDynamicTools(paths: DynamicToolPaths): Array<{
  name: string;
  description: string;
  inputSchema: ToolSchema['inputSchema'];
  outputSchema?: ToolSchema['outputSchema'];
  runtime?: ToolSchema['runtime'];
  contractFingerprint?: string;
  executable: boolean;
  sourceScope: 'workspace' | 'managed' | 'unknown';
}> {
  return mcpManager.getTools().map((tool) => {
    const source = mcpManager.getToolSource(tool.name);
    const descriptor = mcpManager.getRuntimeDescriptor(tool.name);
    return {
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
      outputSchema: tool.outputSchema,
      runtime: tool.runtime,
      contractFingerprint: descriptor?.contractFingerprint,
      executable: typeof tool.handler === 'function',
      sourceScope: getToolSourceScope(paths, source),
    };
  });
}

export function getGeminiFunctionDeclarations(): Array<Record<string, unknown>> {
  return mcpManager.getTools().map((tool) => ({
    name: tool.name,
    description: tool.description,
    parameters: normalizeGeminiSchemaNode(tool.inputSchema),
  }));
}

function getToolSourceScope(paths: DynamicToolPaths, source?: ToolSourceInfo): 'workspace' | 'managed' | 'unknown' {
  if (!source) return 'unknown';
  const rootPath = source.rootPath.toLowerCase();
  if (rootPath === paths.getWorkspaceDynamicToolsPath().toLowerCase()) return 'workspace';
  if (rootPath === paths.getManagedDynamicToolsPath().toLowerCase()) return 'managed';
  return 'unknown';
}
