import { MODELS } from '../../config';
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
  if (options?.thinking?.level) {
    generationConfig.thinkingConfig = { thinkingLevel: options.thinking.level };
  } else if (options?.thinking?.budget !== undefined && options.thinking.budget > 0) {
    generationConfig.thinkingConfig = { thinkingBudget: options.thinking.budget };
  }
  return generationConfig;
}

export function buildModelTools(computerUseEnabled: boolean): any[] {
  const hasGoogleWorkspace = typeof window !== 'undefined' && !!(window as any).calendar;
  const tools = computerUseEnabled
    ? [COMPUTER_USE_TOOLS, PROJECT_HUB_TOOLS, NATIVE_AI_TOOLS]
    : [PROJECT_HUB_TOOLS, NATIVE_AI_TOOLS];
  if (hasGoogleWorkspace) tools.push(GOOGLE_WORKSPACE_TOOLS);
  return tools;
}
