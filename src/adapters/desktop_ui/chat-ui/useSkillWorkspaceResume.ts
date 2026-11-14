import { useLayoutEffect, useRef } from 'react';
import { workspaceApi } from '../../../services/skills/workspace-bridge';
import { SYSTEM_SKILLS } from '../../../shared/skills/registry';
import type { ActiveSkillState } from '../../../services/skills/active-skill';

/** Recupera sólo el destino explícito; un error nunca devuelve autoridad al anterior. */
export function useSkillWorkspaceResume(input: {
  conversationId: string | null;
  activeSkill: ActiveSkillState | null;
  setActiveSkill: (state: ActiveSkillState | null) => void;
  onWorkspaceResolved?: (workspace: { id: string; skillId: string } | null) => void;
}): void {
  const { conversationId, activeSkill, setActiveSkill, onWorkspaceResolved } = input;
  const activeRef = useRef(activeSkill);
  const revision = useRef(0);
  const clearingPrevious = useRef(false);
  useLayoutEffect(() => {
    activeRef.current = activeSkill;
    if (clearingPrevious.current && !activeSkill) { clearingPrevious.current = false; return; }
    clearingPrevious.current = false;
    ++revision.current;
  }, [activeSkill]);
  const previous = useRef(conversationId);
  useLayoutEffect(() => {
    const changed = previous.current !== conversationId;
    previous.current = conversationId;
    const initial = activeRef.current;
    if (!changed && initial && (!initial.conversationId || initial.conversationId === conversationId)) return;
    // Limpiar antes del viaje IPC evita enviar con las herramientas de otro chat.
    onWorkspaceResolved?.(null);
    if (changed) {
      clearingPrevious.current = Boolean(initial);
      setActiveSkill(null);
    }
    if (!conversationId) return;
    const api = workspaceApi();
    if (!api) return;
    const expectedRevision = revision.current;
    let current = true;
    void api.findByConversation(conversationId).then(result => {
      if (!current || revision.current !== expectedRevision || (activeRef.current && activeRef.current !== initial)) return;
      const workspace = result?.success ? result.workspace : null;
      const skill = workspace && workspace.conversationId === conversationId
        ? SYSTEM_SKILLS.find(candidate => candidate.id === workspace.skillId) : null;
      if (!workspace || !skill) return;
      onWorkspaceResolved?.({ id: workspace.id, skillId: workspace.skillId });
      setActiveSkill({
        skill, conversationId, workspaceId: workspace.id, brandingNotice: null, workspaceError: null,
        contextNote: [
          '=== CONTINUACION DE UN TRABAJO EXISTENTE ===',
          'Esta conversación ya tiene un entregable. No vuelvas a preguntar por el tema ni por las fuentes.',
          'Lee los archivos antes de tocarlos y aplica únicamente los cambios solicitados.',
          '===========================================',
        ].join('\n'),
      });
    }).catch(() => {
      if (current) console.warn('[Skills] No se pudo recuperar el espacio de trabajo del chat.');
    });
    return () => { current = false; };
  }, [conversationId, setActiveSkill, onWorkspaceResolved]);
}
