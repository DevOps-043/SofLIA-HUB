import { MODELS } from '../../config';
import { supportsCodeExecutionCombo } from '../../shared/gemini-grounding-config';
import {
  COMPUTER_USE_TOOLS,
  GOOGLE_WORKSPACE_TOOLS,
  INTEGRATED_BROWSER_TOOLS,
  NATIVE_AI_TOOLS,
  PROJECT_HUB_TOOLS,
} from '../gemini-tools';
import { resolveSkillToolGroups, type ActiveSkillContext } from '../gemini-tools/turn-catalog';
import type { SendMessageStreamOptions } from './types';

export function resolveModelId(options?: SendMessageStreamOptions): string {
  return options?.model || MODELS.PRIMARY;
}

export function buildGenerationConfig(options?: SendMessageStreamOptions): Record<string, any> {
  const generationConfig: Record<string, any> = { maxOutputTokens: 16384 };
  const thinkingLevel = resolveGeminiThinkingLevel(options?.thinking?.level);
  if (thinkingLevel) generationConfig.thinkingConfig = { thinkingLevel };
  return generationConfig;
}

/**
 * El producto expone tres niveles de Gemini. Preferencias antiguas sin
 * razonamiento y niveles exclusivos de OpenAI se acotan al extremo visible.
 */
export function resolveGeminiThinkingLevel(value: unknown): 'low' | 'medium' | 'high' | undefined {
  if (value === 'low' || value === 'medium' || value === 'high') return value;
  // Preferencias guardadas por versiones anteriores nunca vuelven a activar un
  // modo sin razonamiento.
  if (value === 'minimal' || value === 'none') return 'low';
  if (value === 'xhigh' || value === 'max') return 'high';
  return undefined;
}

export function buildModelTools(
  computerUseEnabled: boolean,
  modelId?: string,
  activeSkill?: ActiveSkillContext | null,
): any[] {
  const hasGoogleWorkspace = typeof window !== 'undefined' && !!(window as any).calendar;
  const tools: any[] = computerUseEnabled
    ? [COMPUTER_USE_TOOLS, PROJECT_HUB_TOOLS, NATIVE_AI_TOOLS]
    : [PROJECT_HUB_TOOLS, NATIVE_AI_TOOLS];
  if (hasGoogleWorkspace) tools.push(GOOGLE_WORKSPACE_TOOLS);
  if (typeof window !== 'undefined' && !!window.integratedBrowser) tools.push(INTEGRATED_BROWSER_TOOLS);
  // Herramientas de la Skill activa. Sin Skill (o sin workspace vivo) el
  // catalogo queda exactamente igual que antes de este cambio.
  tools.push(...resolveSkillToolGroups(activeSkill));
  // Gemini 3+ permite combinar function calling con ejecucion de codigo:
  // calculos y analisis de datos (pandas) salen de Python real, no de memoria.
  if (modelId && supportsCodeExecutionCombo(modelId)) tools.push({ codeExecution: {} });
  return tools;
}
