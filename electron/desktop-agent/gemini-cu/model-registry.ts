import type { DesktopAgentConfig } from '../../desktop-agent-types';

/**
 * Registro central de modelos actuadores de Computer Use.
 *
 * Regla del estandar: los IDs de modelo NO se dispersan por el codigo. Todo
 * cambio pasa por aqui o por la configuracion del agente, para que cambiar de
 * modelo no obligue a buscar literales sueltos.
 */

export type ComputerUseProfile = 'recommended' | 'compatibility' | 'economy';

export interface ComputerUseModelConfig {
  provider: 'google';
  model: string;
  profile: ComputerUseProfile;
}

/**
 * Modelo recomendado por Google para Computer Use de escritorio. Los perfiles
 * de compatibilidad y economia son respaldo, no alternativas equivalentes:
 * degradar de perfil cuesta pasos y precision visual.
 */
export const COMPUTER_USE_MODEL_DEFAULTS: Record<ComputerUseProfile, string> = {
  recommended: 'gemini-3.6-flash',
  compatibility: 'gemini-3.5-flash',
  economy: 'gemini-3.5-flash-lite',
};

export function resolveComputerUseModel(
  config: DesktopAgentConfig,
  profile: ComputerUseProfile = 'recommended',
): ComputerUseModelConfig {
  const model = modelForProfile(config, profile).trim();
  if (!model) throw new Error(`No hay modelo de Computer Use configurado para el perfil "${profile}".`);
  return { provider: 'google', model, profile };
}

/**
 * Perfil de respaldo ante un fallo del proveedor. Devuelve null cuando ya no
 * quedan escalones: un fallo visual NO debe degradar de modelo, porque casi
 * siempre viene de DPI, monitor equivocado o coordenadas, no del modelo.
 */
export function nextComputerUseProfile(profile: ComputerUseProfile): ComputerUseProfile | null {
  if (profile === 'recommended') return 'compatibility';
  if (profile === 'compatibility') return 'economy';
  return null;
}

/** Un valor en blanco cuenta como "sin configurar" y cae al default del perfil. */
function modelForProfile(config: DesktopAgentConfig, profile: ComputerUseProfile): string {
  if (profile === 'compatibility') return config.computerUseFallbackModel?.trim() || COMPUTER_USE_MODEL_DEFAULTS.compatibility;
  if (profile === 'economy') return config.computerUseEconomyModel?.trim() || COMPUTER_USE_MODEL_DEFAULTS.economy;
  return config.computerUseModel?.trim() || COMPUTER_USE_MODEL_DEFAULTS.recommended;
}
