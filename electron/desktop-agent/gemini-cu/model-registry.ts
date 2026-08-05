import type { DesktopAgentConfig } from '../../desktop-agent-types';
import { SOFLIA_RUNTIME_MODEL } from '../../../src/shared/soflia-runtime-model';

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
  recommended: SOFLIA_RUNTIME_MODEL,
  compatibility: SOFLIA_RUNTIME_MODEL,
  economy: SOFLIA_RUNTIME_MODEL,
};

export function resolveComputerUseModel(
  config: DesktopAgentConfig,
  profile: ComputerUseProfile = 'recommended',
): ComputerUseModelConfig {
  void config;
  return { provider: 'google', model: SOFLIA_RUNTIME_MODEL, profile };
}

/**
 * Perfil de respaldo ante un fallo del proveedor. Devuelve null cuando ya no
 * quedan escalones: un fallo visual NO debe degradar de modelo, porque casi
 * siempre viene de DPI, monitor equivocado o coordenadas, no del modelo.
 */
export function nextComputerUseProfile(profile: ComputerUseProfile): ComputerUseProfile | null {
  void profile;
  return null;
}
