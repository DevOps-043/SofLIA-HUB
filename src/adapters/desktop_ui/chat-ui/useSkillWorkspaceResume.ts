import { useEffect, useRef } from 'react';
import { workspaceApi } from '../../../services/skills/workspace-bridge';
import { SYSTEM_SKILLS } from '../../../shared/skills/registry';
import type { ActiveSkillState } from '../../../services/skills/active-skill';

/**
 * Reanuda la Skill de una conversacion que ya tiene entregable.
 *
 * Sin esto, pedir un cambio sobre una presentacion ya generada llegaba al
 * modelo SIN las herramientas del workspace: el turno solo declara esas
 * herramientas mientras hay una Skill activa, y la Skill solo se activaba al
 * escribir el comando. El resultado era el modelo describiendo los ajustes que
 * haria y terminando con "no tengo acceso al espacio de trabajo", con los
 * archivos intactos en disco.
 *
 * La reanudacion es silenciosa y no pisa nada: solo actua cuando no hay Skill
 * activa —si el usuario la desactivo a proposito, se respeta hasta que cambie
 * de conversacion— y cuando la conversacion tiene un workspace real.
 */
export function useSkillWorkspaceResume(input: {
  conversationId: string | null;
  activeSkill: ActiveSkillState | null;
  setActiveSkill: (state: ActiveSkillState) => void;
  /** Apunta el panel a la presentacion de esta conversacion, o a ninguna. */
  onWorkspaceResolved?: (workspace: { id: string; skillId: string } | null) => void;
}): void {
  const { conversationId, activeSkill, setActiveSkill, onWorkspaceResolved } = input;
  // Una sola tentativa por conversacion: si el usuario desactiva la Skill, no
  // se la volvemos a imponer en el siguiente render.
  const intentada = useRef<string | null>(null);

  useEffect(() => {
    const api = workspaceApi();
    if (!api || !conversationId || activeSkill || intentada.current === conversationId) return;
    intentada.current = conversationId;

    let vigente = true;
    void api.findByConversation(conversationId).then((resultado) => {
      const workspace = resultado?.workspace;
      if (!vigente) return;
      // Se resuelve SIEMPRE, tambien sin presentacion: asi el panel deja de
      // apuntar a la de la conversacion anterior.
      onWorkspaceResolved?.(workspace ? { id: workspace.id, skillId: workspace.skillId } : null);
      if (!workspace) return;
      const skill = SYSTEM_SKILLS.find((candidate) => candidate.id === workspace.skillId);
      if (!skill) return;
      setActiveSkill({
        skill,
        workspaceId: workspace.id,
        brandingNotice: null,
        workspaceError: null,
        // La identidad y el sistema de diseno ya estan escritos en la carpeta:
        // lo que el modelo necesita saber es que continua un trabajo, no que
        // empieza uno. El protocolo de recoleccion no aplica aqui.
        contextNote: [
          '=== CONTINUACION DE UN TRABAJO EXISTENTE ===',
          `Esta conversacion ya tiene un entregable de la skill "${skill.name}" en su espacio de trabajo.`,
          'No vuelvas a preguntar por el tema ni por las fuentes, y no lo regeneres desde cero.',
          'Lee los archivos antes de tocarlos y aplica los cambios que pida el usuario por reemplazo exacto.',
          '===========================================',
        ].join('\n'),
      });
    }).catch((error) => {
      console.warn('[Skills] No se pudo reanudar el espacio de trabajo de la conversacion:', error);
    });

    return () => { vigente = false; };
  }, [conversationId, activeSkill, setActiveSkill, onWorkspaceResolved]);
}
