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
  // Resolucion de medios del turno. Sin medios no se declara: el proveedor
  // aplica su valor por omision y el turno queda igual que antes del cambio.
  const mediaResolution = resolveMediaResolution(options?.mediaResolution);
  if (mediaResolution) generationConfig.mediaResolution = mediaResolution;
  return generationConfig;
}

/**
 * Traduce la resolucion de medios del producto al enum del proveedor.
 *
 * `low` cuesta del orden de 100 tokens por segundo de video y `medium` unos
 * 300; `high` se reserva para leer texto pequeño o cifras en una imagen. El
 * valor efectivo se decide en el constructor de partes segun la duracion
 * enviada, no en la interfaz.
 */
export function resolveMediaResolution(value: unknown): string | undefined {
  if (value === 'low') return 'MEDIA_RESOLUTION_LOW';
  if (value === 'medium') return 'MEDIA_RESOLUTION_MEDIUM';
  if (value === 'high') return 'MEDIA_RESOLUTION_HIGH';
  return undefined;
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
