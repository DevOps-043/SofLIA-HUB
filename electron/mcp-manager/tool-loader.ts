import * as fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseToolContract } from './tool-contract';
import type { LoadedTool } from './types';

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

    const tool = parseToolContract(toolData);

    return { tool, source: { filePath, filename, rootPath } };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.warn(`[MCP] Invalid tool contract in ${filePath}: ${reason}`);
    return null;
  }
}

async function importToolModule(filePath: string): Promise<unknown> {
  const fileUrl = pathToFileURL(filePath).href;
  const moduleUrl = `${fileUrl}?t=${Date.now()}`;
  const module = await import(moduleUrl) as Record<string, unknown>;
  return module.default ?? module.tool ?? module;
}
