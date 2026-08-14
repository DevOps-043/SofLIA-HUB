import type { ActiveSkillContext } from '../gemini-tools/turn-catalog';

/**
 * Condicion de salida verificable para una Skill que entrega archivos.
 *
 * El texto del modelo no es evidencia de que el entregable exista. Para
 * Presentaciones, el estado autoritativo vive en main y solo esta listo cuando
 * existe el documento de entrada del workspace (deck.json en el runtime React).
 */
const PRESENTACIONES_SKILL_ID = 'sistema:presentaciones';

export const WORKSPACE_REPAIR_INSTRUCTION = `La presentacion no esta terminada: el documento de entrada del workspace todavia no existe. Continua trabajando ahora. Escribe deck.json, vuelve a leerlo para verificarlo y no respondas que terminaste hasta que workspace_list_files confirme que existe.`;

export const WORKSPACE_INCOMPLETE_MESSAGE = 'No pude completar la presentacion en este turno: falta deck.json. El guion y los recursos quedaron guardados; vuelve a intentarlo para que SofLIA termine el deck.';

type WorkspaceStateResponse = {
  success?: boolean;
  error?: string;
  state?: { ready?: boolean; workspace?: { entryFile?: string } };
};

type WorkspaceStateBridge = {
  getState: (workspaceId: string) => Promise<WorkspaceStateResponse>;
};

export type WorkspaceCompletion =
  | { required: false; ready: true }
  | { required: true; ready: true }
  | { required: true; ready: false; message: string };

/**
 * Comprueba el resultado real sin inventar exito si el puente no esta
 * disponible. Ese caso solo ocurre fuera del escritorio o en pruebas de otro
 * flujo; no debe bloquear Skills que no sean Presentaciones.
 */
export async function inspectWorkspaceCompletion(
  activeSkill: ActiveSkillContext | null | undefined,
): Promise<WorkspaceCompletion> {
  if (activeSkill?.id !== PRESENTACIONES_SKILL_ID || !activeSkill.workspaceId) {
    return { required: false, ready: true };
  }

  const api = workspaceStateBridge();
  if (!api) return { required: false, ready: true };

  try {
    const response = await api.getState(activeSkill.workspaceId);
    if (response.success && response.state?.ready) return { required: true, ready: true };

    const entryFile = response.state?.workspace?.entryFile?.trim() || 'deck.json';
    return {
      required: true,
      ready: false,
      message: response.error?.trim() || `Falta ${entryFile}; el entregable aun no existe.`,
    };
  } catch (error) {
    return {
      required: true,
      ready: false,
      message: error instanceof Error ? error.message : 'No se pudo comprobar el estado del workspace.',
    };
  }
}

function workspaceStateBridge(): WorkspaceStateBridge | null {
  if (typeof window === 'undefined') return null;
  const scope = window as Window & { skillWorkspace?: Partial<WorkspaceStateBridge> };
  return typeof scope.skillWorkspace?.getState === 'function'
    ? scope.skillWorkspace as WorkspaceStateBridge
    : null;
}
