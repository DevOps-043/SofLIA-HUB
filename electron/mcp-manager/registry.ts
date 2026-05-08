import { loadToolFromPath } from './tool-loader';
import type { ToolSchema, ToolSourceInfo } from './types';

export async function registerToolFromPath(
  filePath: string,
  rootPath: string,
  tools: Map<string, ToolSchema>,
  toolSources: Map<string, ToolSourceInfo>,
  emitRegistered: (tool: ToolSchema) => void,
): Promise<void> {
  const loaded = await loadToolFromPath(filePath, rootPath);
  if (!loaded) return;

  const existingSource = toolSources.get(loaded.tool.name);
  if (existingSource) {
    console.log(`[MCP] Tool "${loaded.tool.name}" from ${filePath} ignored because it is already provided by ${existingSource.filePath}`);
    return;
  }

  tools.set(loaded.tool.name, loaded.tool);
  toolSources.set(loaded.tool.name, loaded.source);
  emitRegistered(loaded.tool);
  console.log(`[MCP] Registered dynamic tool: ${loaded.tool.name} (${filePath})`);
}
