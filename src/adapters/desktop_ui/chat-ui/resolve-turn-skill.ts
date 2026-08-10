import { SYSTEM_SKILLS } from '../../../shared/skills/registry';
import type { ActiveSkillState } from '../../../services/skills/active-skill';

/**
 * Skill que gobierna ESTE turno.
 *
 * Antes salia solo del estado del compositor, y ese estado no sobrevive a un
 * remonte del chat: tras generar una presentacion, pedir un cambio llegaba al
 * modelo sin herramientas de archivo y respondia "no tengo acceso operativo a
 * los archivos" con la carpeta intacta en disco.
 *
 * El espacio de trabajo resuelto por la conversacion —el mismo que alimenta el
 * panel— es una fuente mas fiable que el estado de un componente: si el panel
 * muestra la presentacion, el turno tiene sus herramientas. Esa es la
 * invariante que esta funcion garantiza.
 */
export function resolveTurnSkill(input: {
  /** Skill elegida explicitamente en el compositor, si la hay. */
  activeSkill: ActiveSkillState | null;
  /** Espacio de trabajo de la conversacion, resuelto por el panel. */
  workspaceId: string | null;
  skillId: string | null;
}): ActiveSkillState | null {
  const { activeSkill, workspaceId, skillId } = input;

  // La eleccion explicita manda. Si le falta el workspace pero la conversacion
  // tiene uno, se completa: una Skill activa sin destino no puede escribir.
  if (activeSkill) {
    return activeSkill.workspaceId || !workspaceId
      ? activeSkill
      : { ...activeSkill, workspaceId };
  }

  if (!workspaceId || !skillId) return null;
  const skill = SYSTEM_SKILLS.find((candidate) => candidate.id === skillId);
  if (!skill) return null;

  return {
    skill,
    workspaceId,
    brandingNotice: null,
    workspaceError: null,
    contextNote: [
      '=== CONTINUACION DE UN TRABAJO EXISTENTE ===',
      `Esta conversacion ya tiene un entregable de la skill "${skill.name}" en su espacio de trabajo,`,
      'y dispones de sus herramientas de archivo en este turno.',
      'No vuelvas a preguntar por el tema ni por las fuentes, y no lo regeneres desde cero.',
      'Lee los archivos antes de tocarlos y aplica los cambios por reemplazo exacto.',
      'NO afirmes que no puedes acceder a los archivos: si lo crees, llama a workspace_list_files y compruebalo.',
      '===========================================',
    ].join('\n'),
  };
}
