import {
  COMPUTER_TOOL_NAMES,
  GOOGLE_WORKSPACE_TOOL_NAMES,
  NATIVE_AI_TOOL_NAMES,
  PROJECT_HUB_TOOL_NAMES,
} from '../gemini-tools';
import { executeComputerToolAsJson } from './computer-tool-result';
import { executeNativeAiTool } from './native-ai-tools';
import { executeProjectHubTool } from './project-hub-tools';
import type { SendMessageStreamOptions, ToolCallInfo } from './types';
import { executeGoogleWorkspaceTool } from './workspace-tools';

export function isKnownGeminiTool(toolName: string): boolean {
  return COMPUTER_TOOL_NAMES.has(toolName) || PROJECT_HUB_TOOL_NAMES.has(toolName) || GOOGLE_WORKSPACE_TOOL_NAMES.has(toolName) || NATIVE_AI_TOOL_NAMES.has(toolName);
}

export async function executeGeminiToolCall(
  toolName: string,
  toolArgs: Record<string, any>,
  options: SendMessageStreamOptions | undefined,
  allToolCalls: ToolCallInfo[],
  generatedImages: string[],
): Promise<{ functionResponse: { name: string; response: any } }> {
  // toolInfo conserva los args originales (sin base64) para UI e historial;
  // el ejecutor recibe los args enriquecidos (p. ej. graficas para el Word).
  const toolInfo: ToolCallInfo = { name: toolName, args: toolArgs };
  options?.onToolCall?.(toolInfo);
  try {
    const resultStr = await executeKnownTool(toolName, enrichToolArgs(toolName, toolArgs, generatedImages), generatedImages);
    toolInfo.result = resultStr;
    allToolCalls.push(toolInfo);
    return { functionResponse: { name: toolName, response: JSON.parse(resultStr) } };
  } catch (err: any) {
    const errorResult = { success: false, error: err.message };
    toolInfo.result = JSON.stringify(errorResult);
    allToolCalls.push(toolInfo);
    return { functionResponse: { name: toolName, response: errorResult } };
  }
}

/**
 * Las graficas de code execution viven como data URLs en el pipeline, no en el
 * modelo (no puede re-emitir base64 en los args). Al crear un Word se inyectan
 * automaticamente para que el documento incluya las graficas de la conversacion.
 */
function enrichToolArgs(toolName: string, args: Record<string, any>, generatedImages: string[]): Record<string, any> {
  if (toolName === 'create_word_document' && generatedImages.length > 0 && !args.chart_images) {
    return { ...args, chart_images: generatedImages.slice(0, 8) };
  }
  return args;
}

function executeKnownTool(toolName: string, args: Record<string, any>, generatedImages: string[]): Promise<string> {
  if (GOOGLE_WORKSPACE_TOOL_NAMES.has(toolName)) return executeGoogleWorkspaceTool(toolName, args);
  if (PROJECT_HUB_TOOL_NAMES.has(toolName)) return executeProjectHubTool(toolName, args);
  if (NATIVE_AI_TOOL_NAMES.has(toolName)) return executeNativeAiTool(toolName, args, generatedImages);
  return executeComputerToolAsJson(toolName, args);
}
