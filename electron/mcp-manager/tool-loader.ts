import * as fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { LoadedTool, ToolSchema } from './types';

export async function loadToolFromPath(
  filePath: string,
  rootPath: string,
): Promise<LoadedTool | null> {
  const filename = path.basename(filePath);
  const ext = path.extname(filename);
  if (!['.json', '.js', '.ts'].includes(ext)) return null;

  try {
    const stats = fs.statSync(filePath);
    if (!stats.isFile()) return null;

    const toolData = ext === '.json'
      ? JSON.parse(fs.readFileSync(filePath, 'utf-8'))
      : await importToolModule(filePath);

    if (!isValidToolSchema(toolData)) {
      console.warn(`[MCP] Invalid tool schema in file: ${filePath}`);
      return null;
    }

    return { tool: toolData, source: { filePath, filename, rootPath } };
  } catch (error) {
    console.error(`[MCP] Error loading tool from ${filePath}:`, error);
    return null;
  }
}

async function importToolModule(filePath: string): Promise<any> {
  const fileUrl = pathToFileURL(filePath).href;
  const moduleUrl = `${fileUrl}?t=${Date.now()}`;
  const module = await import(moduleUrl);
  return module.default || module.tool || module;
}

function isValidToolSchema(data: any): data is ToolSchema {
  return (
    data &&
    typeof data.name === 'string' &&
    typeof data.description === 'string' &&
    data.inputSchema &&
    typeof data.inputSchema === 'object' &&
    data.inputSchema.type === 'object' &&
    typeof data.inputSchema.properties === 'object'
  );
}
