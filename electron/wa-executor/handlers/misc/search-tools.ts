import { SmartSearchTool } from '../../../smart-search-tool';
import { readWebpage, smartFindFile, webSearch } from '../../../whatsapp-prompts';
import { buildResponse, errorResponse, type FunctionResponse, type ToolExecutorContext } from '../../types';
import { SEARCH_TOOLS } from './tool-sets';

export async function executeSearchTool(
  toolName: string,
  toolArgs: Record<string, any>,
  ctx: ToolExecutorContext,
): Promise<FunctionResponse | null> {
  if (!SEARCH_TOOLS.has(toolName)) return null;

  if (toolName === 'smart_find_file') {
    return buildResponse(toolName, await smartFindFile(toolArgs.filename));
  }
  if (toolName === 'web_search') {
    return buildResponse(toolName, await webSearch(toolArgs.query));
  }
  if (toolName === 'read_webpage') {
    return buildResponse(toolName, await readWebpage(toolArgs.url));
  }
  if (toolName === 'search_clipboard_history') {
    if (!ctx.clipboardAssistant) {
      return errorResponse(toolName, 'Clipboard Assistant no inicializado.');
    }
    const data = await ctx.clipboardAssistant.searchClipboardHistory(toolArgs.query);
    return buildResponse(toolName, { success: true, data });
  }
  if (toolName === 'semantic_file_search') {
    if (!ctx.smartSearch) ctx.smartSearch = new SmartSearchTool();
    return buildResponse(toolName, ctx.smartSearch.searchFiles(toolArgs.query, toolArgs.max_results || 3));
  }

  return null;
}
