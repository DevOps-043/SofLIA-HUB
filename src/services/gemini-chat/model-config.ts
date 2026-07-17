import { MODELS } from '../../config';
import { supportsCodeExecutionCombo } from '../../shared/gemini-grounding-config';
import {
  COMPUTER_USE_TOOLS,
  GOOGLE_WORKSPACE_TOOLS,
  NATIVE_AI_TOOLS,
  PROJECT_HUB_TOOLS,
} from '../gemini-tools';
import type { SendMessageStreamOptions } from './types';

export function resolveModelId(options?: SendMessageStreamOptions): string {
  return options?.model || MODELS.PRIMARY;
}

export function buildGenerationConfig(options?: SendMessageStreamOptions): Record<string, any> {
  const generationConfig: Record<string, any> = { maxOutputTokens: 16384 };
  void options;
  return generationConfig;
}

export function buildModelTools(computerUseEnabled: boolean, modelId?: string): any[] {
  const hasGoogleWorkspace = typeof window !== 'undefined' && !!(window as any).calendar;
  const tools: any[] = computerUseEnabled
    ? [COMPUTER_USE_TOOLS, PROJECT_HUB_TOOLS, NATIVE_AI_TOOLS]
    : [PROJECT_HUB_TOOLS, NATIVE_AI_TOOLS];
  if (hasGoogleWorkspace) tools.push(GOOGLE_WORKSPACE_TOOLS);
  // Gemini 3+ permite combinar function calling con ejecucion de codigo:
  // calculos y analisis de datos (pandas) salen de Python real, no de memoria.
  if (modelId && supportsCodeExecutionCombo(modelId)) tools.push({ codeExecution: {} });
  return tools;
}
