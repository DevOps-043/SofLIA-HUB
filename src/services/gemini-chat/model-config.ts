import { MODELS } from '../../config';
import { supportsCodeExecutionCombo } from '../../shared/gemini-grounding-config';
import {
  COMPUTER_USE_TOOLS,
  GOOGLE_WORKSPACE_TOOLS,
  INTEGRATED_BROWSER_TOOLS,
  NATIVE_AI_TOOLS,
  PROJECT_HUB_TOOLS,
} from '../gemini-tools';
import { filterDeclarationsBySelection, resolveSkillToolGroups, type ActiveSkillContext } from '../gemini-tools/turn-catalog';
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
  const base: any[] = computerUseEnabled
    ? [COMPUTER_USE_TOOLS, PROJECT_HUB_TOOLS, NATIVE_AI_TOOLS]
    : [PROJECT_HUB_TOOLS, NATIVE_AI_TOOLS];
  if (hasGoogleWorkspace) base.push(GOOGLE_WORKSPACE_TOOLS);
  if (typeof window !== 'undefined' && !!window.integratedBrowser) base.push(INTEGRATED_BROWSER_TOOLS);

  // Seleccion del usuario para esta Skill: acota el catalogo ANTES de enviarlo.
  // Un grupo que se queda sin declaraciones no se envia: un `functionDeclarations`
  // vacio es una entrada invalida para el proveedor.
  const tools: any[] = base
    .map((group) => ({
      ...group,
      functionDeclarations: filterDeclarationsBySelection(
        group.functionDeclarations,
        activeSkill?.allowedTools,
      ),
    }))
    .filter((group) => group.functionDeclarations.length > 0);
  // Herramientas de la Skill activa. Sin Skill (o sin workspace vivo) el
  // catalogo queda exactamente igual que antes de este cambio.
  tools.push(...resolveSkillToolGroups(activeSkill));
  // Gemini 3+ permite combinar function calling con ejecucion de codigo:
  // calculos y analisis de datos (pandas) salen de Python real, no de memoria.
  if (modelId && supportsCodeExecutionCombo(modelId)) tools.push({ codeExecution: {} });
  return tools;
}
