import { app } from 'electron';
import path from 'node:path';
import { toolError, toolResponse } from '../types';
import type { ToolExecutorContext } from '../types';
import type { GoogleExecutorResult } from './types';

const DRIVE_TOOLS = new Set(['drive_list_files', 'drive_search', 'drive_download', 'drive_upload', 'drive_create_folder']);

export async function executeDriveTool(
  toolName: string,
  toolArgs: Record<string, any>,
  ctx: ToolExecutorContext,
  bulkLabelsToVerify: Set<string> | null,
): Promise<GoogleExecutorResult | null> {
  if (!DRIVE_TOOLS.has(toolName)) return null;

  try {
    if (!ctx.driveService) return { response: toolError(toolName, 'Google Drive no conectado.'), bulkLabelsToVerify };

    if (toolName === 'drive_list_files') {
      return {
        response: toolResponse(toolName, await ctx.driveService.listFiles({
          folderId: toolArgs.folder_id,
          maxResults: toolArgs.max_results || 20,
        })),
        bulkLabelsToVerify,
      };
    }
    if (toolName === 'drive_search') {
      return { response: toolResponse(toolName, await ctx.driveService.searchFiles(toolArgs.query)), bulkLabelsToVerify };
    }
    if (toolName === 'drive_download') {
      const tmpDir = app.getPath('temp');
      const fallbackName = toolArgs.file_name || `drive_${toolArgs.file_id}`;
      const destinationPath = toolArgs.destination_path || path.join(tmpDir, fallbackName);
      const format = toolArgs.format === 'pdf' ? 'pdf' as const : 'text' as const;
      const result = await ctx.driveService.downloadFile(toolArgs.file_id, destinationPath, format);
      return { response: toolResponse(toolName, { ...result, localPath: result.path || destinationPath }), bulkLabelsToVerify };
    }
    if (toolName === 'drive_upload') {
      return {
        response: toolResponse(toolName, await ctx.driveService.uploadFile(toolArgs.file_path, {
          name: toolArgs.name,
          folderId: toolArgs.folder_id,
        })),
        bulkLabelsToVerify,
      };
    }

    return {
      response: toolResponse(toolName, await ctx.driveService.createFolder(toolArgs.name, toolArgs.parent_id)),
      bulkLabelsToVerify,
    };
  } catch (err: any) {
    return { response: toolError(toolName, err.message), bulkLabelsToVerify };
  }
}
