import {
  GOOGLE_WORKSPACE_TOOL_NAMES,
  INTEGRATED_BROWSER_TOOL_NAMES,
  NATIVE_AI_TOOL_NAMES,
  PROJECT_HUB_TOOL_NAMES,
} from '../gemini-tools';
import { isKnownTurnTool, resolveSkillToolNames, type ActiveSkillContext } from '../gemini-tools/turn-catalog';
import { executeComputerToolAsJson } from './computer-tool-result';
import { executeNativeAiTool } from './native-ai-tools';
import { executeProjectHubTool } from './project-hub-tools';
import { executeSkillWorkspaceTool } from './skill-workspace-tools';
import { prepareToolResult } from './tool-result-payload';
import type { SendMessageStreamOptions, ToolCallInfo } from './types';
import { executeGoogleWorkspaceTool } from './workspace-tools';
import { executeIntegratedBrowserTool } from './integrated-browser-tools';

/**
 * Despacho de herramientas del turno. Resuelve primero contra las
 * herramientas de la Skill activa y degrada al catalogo base cuando no hay
 * Skill: sin Skill activa el comportamiento es identico al anterior.
 */
export function isKnownGeminiTool(toolName: string, activeSkill?: ActiveSkillContext | null): boolean {
  return isKnownTurnTool(toolName, activeSkill);
}

export async function executeGeminiToolCall(
  toolName: string,
  toolArgs: Record<string, any>,
  options: SendMessageStreamOptions | undefined,
  allToolCalls: ToolCallInfo[],
  generatedImages: string[],
): Promise<{ functionResponse: { name: string; response: any }; images?: string[] }> {
  // toolInfo conserva los args originales (sin base64) para UI e historial;
  // el ejecutor recibe los args enriquecidos (p. ej. graficas para el Word).
  const toolInfo: ToolCallInfo = { name: toolName, args: toolArgs };
  options?.onToolCall?.(toolInfo);
  try {
    const resultStr = await executeKnownTool(
      toolName,
      enrichToolArgs(toolName, toolArgs, generatedImages),
      generatedImages,
      options?.activeSkill,
    );
    toolInfo.result = resultStr;
    allToolCalls.push(toolInfo);
    // El resultado cruza aqui la frontera hacia el contexto del modelo: una
    // captura en base64 o un volcado enorme se reenviarian en cada iteracion.
    const payload = prepareToolResult(resultStr);
    return {
      functionResponse: { name: toolName, response: JSON.parse(payload.text) },
      ...(payload.images.length > 0 ? { images: payload.images } : {}),
    };
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

function executeKnownTool(
  toolName: string,
  args: Record<string, any>,
  generatedImages: string[],
  activeSkill?: ActiveSkillContext | null,
): Promise<string> {
  // Las herramientas de la Skill activa se resuelven primero: son las unicas
  // que dependen del contexto del turno.
  if (resolveSkillToolNames(activeSkill).includes(toolName)) {
    return executeSkillWorkspaceTool(toolName, args, activeSkill);
  }
  if (GOOGLE_WORKSPACE_TOOL_NAMES.has(toolName)) return executeGoogleWorkspaceTool(toolName, args);
  if (INTEGRATED_BROWSER_TOOL_NAMES.has(toolName)) return executeIntegratedBrowserTool(toolName, args);
  if (PROJECT_HUB_TOOL_NAMES.has(toolName)) return executeProjectHubTool(toolName, args);
  if (NATIVE_AI_TOOL_NAMES.has(toolName)) return executeNativeAiTool(toolName, args, generatedImages);
  return executeComputerToolAsJson(toolName, args);
}
