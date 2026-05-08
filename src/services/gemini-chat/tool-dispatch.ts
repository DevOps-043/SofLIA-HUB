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
  const toolInfo: ToolCallInfo = { name: toolName, args: toolArgs };
  options?.onToolCall?.(toolInfo);
  try {
    const resultStr = await executeKnownTool(toolName, toolArgs, generatedImages);
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

function executeKnownTool(toolName: string, args: Record<string, any>, generatedImages: string[]): Promise<string> {
  if (GOOGLE_WORKSPACE_TOOL_NAMES.has(toolName)) return executeGoogleWorkspaceTool(toolName, args);
  if (PROJECT_HUB_TOOL_NAMES.has(toolName)) return executeProjectHubTool(toolName, args);
  if (NATIVE_AI_TOOL_NAMES.has(toolName)) return executeNativeAiTool(toolName, args, generatedImages);
  return executeComputerToolAsJson(toolName, args);
}
