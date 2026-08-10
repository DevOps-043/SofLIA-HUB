import { prepareSkillWorkspace, type SkillActivationContext } from '../../../services/skills/active-skill';
import { markUserSkillUsed } from '../../../services/skills/user-skills-store';
import { isSystemSkill, isUserSkill, type Skill, type UserSkill } from '../../../shared/skills/types';
import type { useChatUIState } from './useChatUIState';

/**
 * Acciones del menu de herramientas del compositor y activacion de Skills.
 *
 * Activar una Skill del sistema con workspace crea (o recupera) su carpeta y
 * escribe la hoja de marca antes de que el modelo pueda escribir nada.
 */
export function useChatTools(
  canSendMessages: boolean,
  state: ReturnType<typeof useChatUIState>,
  context: {
    conversationId: string | null;
    organizationId: string | null;
    organizationName: string | null;
    /** Senales que deciden por que rama del protocolo arranca la Skill. */
    activation: SkillActivationContext;
    /** Avisa al panel de que hay una presentacion activa. */
    onWorkspaceReady?: (workspace: { id: string; skillId: string }) => void;
  },
) {
  const handleToolSelect = (toolId: string) => {
    if (!canSendMessages) {
      state.tools.setOpen(false);
      return;
    }
    switch (toolId) {
      case 'attach_file':
        state.refs.fileInputRef.current?.click();
        break;
      case 'image_gen':
        state.modes.setImageGen((current) => !current);
        state.modes.setPromptOptimizer(false);
        break;
      case 'prompt_opt':
        state.modes.setPromptOptimizer((current) => !current);
        state.modes.setImageGen(false);
        break;
      case 'create_prompt':
        state.skillModals.setSavePromptText(state.input.value.trim());
        state.skillModals.setEditingSkill(null);
        state.skillModals.setEditorOpen(true);
        break;
      case 'my_skills':
        state.skillModals.setLibraryOpen(true);
        break;
      default:
        break;
    }
    state.tools.setOpen(false);
  };

  const handleUseSkill = async (skill: Skill) => {
    state.skillModals.setLibraryOpen(false);
    // Se activa de inmediato con sus instrucciones; el workspace llega
    // despues para no bloquear la interfaz mientras se crea la carpeta.
    state.skillModals.setActiveSkill({ skill, workspaceId: null, brandingNotice: null, workspaceError: null, contextNote: null });

    // El uso ordena la biblioteca del usuario. No bloquea la activacion: si
    // falla, la Skill se usa igual y solo se pierde el contador.
    if (isUserSkill(skill)) {
      void markUserSkillUsed(skill.id, skill.usageCount);
    }

    if (!isSystemSkill(skill) || !skill.workspace) return;

    const prepared = await prepareSkillWorkspace({
      skill,
      conversationId: context.conversationId,
      organizationId: context.organizationId,
      context: { ...context.activation, organizationName: context.organizationName },
    });
    state.skillModals.setActiveSkill(prepared);
    if (prepared.workspaceId) context.onWorkspaceReady?.({ id: prepared.workspaceId, skillId: skill.id });
  };

  const handleDeactivateSkill = () => {
    // Desactivar solo quita las instrucciones del turno: la conversacion y el
    // workspace siguen intactos.
    state.skillModals.setActiveSkill(null);
  };

  const handleEditSkill = (skill: UserSkill) => {
    state.skillModals.setEditingSkill(skill);
    state.skillModals.setSavePromptText('');
    state.skillModals.setLibraryOpen(false);
    state.skillModals.setEditorOpen(true);
  };

  return { handleToolSelect, handleUseSkill, handleDeactivateSkill, handleEditSkill };
}
