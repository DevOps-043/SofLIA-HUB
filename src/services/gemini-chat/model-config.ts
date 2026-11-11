import { MODELS } from '../../config';
import { supportsCodeExecutionCombo } from '../../shared/gemini-grounding-config';
import type { ActiveSkillContext } from '../gemini-tools/turn-catalog';
import { buildTurnToolGroups } from './turn-tool-groups';
import type { SendMessageStreamOptions } from './types';

export function resolveModelId(options?: SendMessageStreamOptions): string {
  return options?.model || MODELS.PRIMARY;
}

/**
 * Config de una peticion concreta del chat.
 *
 * En `@google/genai` el `config` por peticion NO hereda del de la sesion: si se
 * manda solo `abortSignal`, esa peticion pierde `tools` y `systemInstruction` y
 * el modelo deja de poder llamar herramientas a media conversacion. Por eso hay
 * que reenviar el config completo en cada envio.
 */
export function withAbortSignal(
  chatConfig: GeminiChatConfig,
  signal?: AbortSignal | null,
): GeminiChatConfig {
  return signal ? { ...chatConfig, abortSignal: signal } : chatConfig;
}

/** Config de sesion/peticion del chat, tal como la consume `@google/genai`. */
export type GeminiChatConfig = Record<string, unknown>;

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
  attachedSourcesOnly = false,
): any[] {
  const tools = buildTurnToolGroups(computerUseEnabled, activeSkill, attachedSourcesOnly);
  return !attachedSourcesOnly && modelId && supportsCodeExecutionCombo(modelId)
    ? [...tools, { codeExecution: {} }]
    : tools;
}
