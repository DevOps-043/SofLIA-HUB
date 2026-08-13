import { useEffect, useRef } from 'react';
import { workspaceApi } from '../../../services/skills/workspace-bridge';
import { SYSTEM_SKILLS } from '../../../shared/skills/registry';
import type { ActiveSkillState } from '../../../services/skills/active-skill';

/**
 * Mantiene la Skill y el panel apuntando a la presentacion DEL CHAT QUE SE ESTA
 * MIRANDO.
 *
 * Resuelve dos fallos distintos:
 *
 * 1. Pedir un cambio sobre una presentacion ya generada llegaba al modelo SIN
 *    las herramientas del workspace —el turno solo las declara mientras hay una
 *    Skill activa, y la Skill solo se activaba al escribir el comando—. El
 *    modelo describia los ajustes y terminaba con "no tengo acceso al espacio
 *    de trabajo", con los archivos intactos en disco.
 *
 * 2. Al abrir OTRO chat, el panel seguia mostrando la presentacion del
 *    anterior: la reanudacion se saltaba entera mientras hubiera una Skill
 *    activa, y despues de generar siempre la hay. Peor que lo visual: la Skill
 *    seguia apuntando al workspace del chat anterior, asi que un cambio pedido
 *    aqui habria editado la baraja de alla.
 *
 * La distincion que lo gobierna todo: pasar de "sin identificador" al suyo NO
 * es cambiar de chat, es el mismo chat al guardarse. Tratarlo como un cambio
 * borraria del panel la presentacion recien generada.
 */
export function useSkillWorkspaceResume(input: {
  conversationId: string | null;
  activeSkill: ActiveSkillState | null;
  setActiveSkill: (state: ActiveSkillState | null) => void;
  /** Apunta el panel a la presentacion de esta conversacion, o a ninguna. */
  onWorkspaceResolved?: (workspace: { id: string; skillId: string } | null) => void;
}): void {
  const { conversationId, activeSkill, setActiveSkill, onWorkspaceResolved } = input;
  // Chat que se estaba mirando. `undefined` es "ninguno todavia".
  const chatVisto = useRef<string | null | undefined>(undefined);
  // Una sola tentativa por chat: si el usuario desactiva la Skill, no se la
  // volvemos a imponer mientras siga en el mismo chat.
  const intentada = useRef<string | null>(null);

  useEffect(() => {
    const api = workspaceApi();
    if (!api) return;

    const anterior = chatVisto.current;
    const seGuardo = anterior === null && conversationId !== null;
    const cambioDeChat = anterior !== undefined && !seGuardo && anterior !== conversationId;
    chatVisto.current = conversationId;

    // El intento pertenecia al chat anterior: en el nuevo hay que resolver de
    // cero, aunque el usuario hubiera desactivado la Skill alla.
    if (cambioDeChat) intentada.current = null;

    if (!conversationId) {
      // Chat nuevo. No hay nada que buscar, pero el panel y la Skill no pueden
      // seguir apuntando a la presentacion del chat anterior.
      if (cambioDeChat) {
        onWorkspaceResolved?.(null);
        setActiveSkill(null);
      }
      return;
    }

    // Dentro del mismo chat se respeta lo que haya: la Skill que el usuario
    // activo, o su decision de quitarla.
    if (!cambioDeChat && (activeSkill || intentada.current === conversationId)) return;
    intentada.current = conversationId;

    let vigente = true;
    void api.findByConversation(conversationId).then((resultado) => {
      const workspace = resultado?.workspace;
      if (!vigente) return;
      // Se resuelve SIEMPRE, tambien sin presentacion: asi el panel deja de
      // apuntar a la de la conversacion anterior.
      onWorkspaceResolved?.(workspace ? { id: workspace.id, skillId: workspace.skillId } : null);

      const skill = workspace ? SYSTEM_SKILLS.find((candidate) => candidate.id === workspace.skillId) : null;
      if (!workspace || !skill) {
        // Este chat no tiene entregable. Dejar activa la Skill del anterior
        // pondria su workspace en las manos del modelo aqui.
        if (cambioDeChat) setActiveSkill(null);
        return;
      }

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
